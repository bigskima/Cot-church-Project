import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const scopes = new Set(["expression", "church", "all"]);
const visibilities = new Set(["members", "private"]);

async function hasScopedPermission(auth: any, permission: string, branchId: string | null) {
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: auth.organizationId,
    requested_permission: permission,
    target_branch_id: branchId,
  });
  return !error && data === true;
}

function capacityValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100000) {
    throw new ApiError("VALIDATION_FAILED", "capacity must be a positive whole number", 422);
  }
  return parsed;
}

function scheduleValue(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_FAILED", "meetingSchedule must be an object", 422);
  }
  return value;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId || !auth.membershipId) {
      throw new ApiError("ORGANIZATION_REQUIRED", "Active church membership is required", 400);
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const requestedScope = url.searchParams.get("scope") ?? (auth.branchId ? "expression" : "church");
      if (!scopes.has(requestedScope)) throw new ApiError("VALIDATION_FAILED", "Invalid group scope", 422);
      if (requestedScope === "expression" && !auth.branchId) {
        throw new ApiError("EXPRESSION_REQUIRED", "Select or join an Expression to view its groups", 400);
      }

      let query = auth.client
        .from("groups")
        .select("id,branch_id,ministry_id,name,description,visibility,capacity,meeting_schedule,is_active,created_at,updated_at")
        .eq("organization_id", auth.organizationId)
        .eq("is_active", true)
        .order("name");
      if (requestedScope === "expression") query = query.eq("branch_id", auth.branchId!);
      if (requestedScope === "church") query = query.is("branch_id", null);

      const { data: groups, error } = await query;
      if (error) throw new ApiError("GROUP_LIST_FAILED", "Unable to list groups", 500, undefined, false);
      const rows = groups ?? [];
      const groupIds = rows.map((group) => group.id);

      const { data: ownMemberships, error: ownError } = groupIds.length
        ? await auth.client
            .from("group_memberships")
            .select("id,group_id,status,is_leader,requested_at,responded_at")
            .eq("membership_id", auth.membershipId)
            .in("group_id", groupIds)
        : { data: [], error: null };
      if (ownError) throw new ApiError("GROUP_MEMBERSHIP_LOOKUP_FAILED", "Unable to resolve your group memberships", 500, undefined, false);
      const ownMap = new Map((ownMemberships ?? []).map((membership: any) => [membership.group_id, membership]));

      let pendingRequests: any[] = [];
      const includeManagement = url.searchParams.get("includeManagement") === "true";
      if (includeManagement && groupIds.length) {
        const targetBranch = requestedScope === "expression" ? auth.branchId : null;
        if (!(await hasScopedPermission(auth, "groups.members.manage", targetBranch))) {
          throw new ApiError("PERMISSION_DENIED", "You do not have permission to manage group memberships in this scope", 403);
        }
        const admin = adminClient();
        const { data: requests, error: requestError } = await admin
          .from("group_memberships")
          .select("id,group_id,membership_id,status,is_leader,requested_at,responded_at")
          .in("group_id", groupIds)
          .eq("status", "requested")
          .order("requested_at", { ascending: true });
        if (requestError) throw new ApiError("GROUP_REQUEST_LIST_FAILED", "Unable to retrieve pending group requests", 500, undefined, false);

        const membershipIds = [...new Set((requests ?? []).map((item: any) => item.membership_id))];
        const { data: members, error: membersError } = membershipIds.length
          ? await admin
              .from("memberships")
              .select("id,profile_id,branch_id,profile:profiles(id,display_name,username,avatar_url)")
              .in("id", membershipIds)
          : { data: [], error: null };
        if (membersError) throw new ApiError("GROUP_REQUEST_LIST_FAILED", "Unable to resolve pending group members", 500, undefined, false);
        const memberMap = new Map((members ?? []).map((item: any) => [item.id, item]));
        pendingRequests = (requests ?? []).map((item: any) => ({ ...item, member: memberMap.get(item.membership_id) ?? null }));
      }

      return {
        data: {
          scope: requestedScope,
          groups: rows.map((group) => ({ ...group, myMembership: ownMap.get(group.id) ?? null })),
          pendingRequests,
        },
      };
    }

    const body = assertObject(await jsonBody(request));
    const action = body.action;

    if (action === "request_membership") {
      assertNoUnknownFields(body, ["action", "groupId"]);
      const groupId = uuid(requiredString(body.groupId, "groupId", 36), "groupId", true)!;
      const { data, error } = await auth.client.rpc("request_group_membership", { target_group_id: groupId }).single();
      if (error?.code === "23514") throw new ApiError("GROUP_FULL", "This group has reached its capacity", 409);
      if (error?.code === "42501") {
        const message = String(error.message ?? "");
        if (message.includes("another Expression")) throw new ApiError("EXPRESSION_SCOPE_DENIED", "This group belongs to another Expression", 403);
        if (message.includes("private group")) throw new ApiError("PRIVATE_GROUP", "This private group does not accept membership requests", 403);
        throw new ApiError("GROUP_ACCESS_DENIED", "You cannot request membership in this group", 403);
      }
      if (error?.code === "P0002") throw new ApiError("GROUP_NOT_FOUND", "Group not found", 404);
      if (error) throw new ApiError("GROUP_JOIN_FAILED", "Unable to request group membership", 500, undefined, false);
      return { data, status: 201 };
    }

    if (action === "review_membership") {
      assertNoUnknownFields(body, ["action", "groupMembershipId", "approved"]);
      if (typeof body.approved !== "boolean") throw new ApiError("VALIDATION_FAILED", "approved must be boolean", 422);
      const { data, error } = await auth.client.rpc("review_group_membership", {
        target_group_membership_id: uuid(requiredString(body.groupMembershipId, "groupMembershipId", 36), "groupMembershipId", true),
        approved: body.approved,
      }).single();
      if (error?.code === "23514") throw new ApiError("GROUP_FULL", "This group has reached its capacity", 409);
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You cannot review this group membership request", 403);
      if (error?.code === "22023") throw new ApiError("REQUEST_ALREADY_REVIEWED", error.message, 409);
      if (error?.code === "P0002") throw new ApiError("GROUP_REQUEST_NOT_FOUND", "Group membership request not found", 404);
      if (error) throw new ApiError("GROUP_REVIEW_FAILED", "Unable to review group membership", 500, undefined, false);
      return { data };
    }

    assertNoUnknownFields(body, ["id", "name", "description", "branchId", "ministryId", "visibility", "capacity", "meetingSchedule", "isActive"]);

    let targetBranchId: string | null;
    if (request.method === "POST") {
      const suppliedBranch = body.branchId === undefined || body.branchId === null ? null : uuid(String(body.branchId), "branchId", true)!;
      if (auth.branchId && suppliedBranch && suppliedBranch !== auth.branchId) {
        throw new ApiError("EXPRESSION_SCOPE_DENIED", "Create this group only inside the currently selected Expression", 403);
      }
      targetBranchId = auth.branchId ?? suppliedBranch;
    } else {
      const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
      const { data: existing, error: existingError } = await auth.client
        .from("groups")
        .select("id,branch_id")
        .eq("id", id)
        .eq("organization_id", auth.organizationId)
        .maybeSingle();
      if (existingError || !existing) throw new ApiError("GROUP_NOT_FOUND", "Group not found in your permitted scope", 404);
      if (auth.branchId && existing.branch_id !== auth.branchId) {
        throw new ApiError("EXPRESSION_SCOPE_DENIED", "This group belongs to another scope", 403);
      }
      targetBranchId = existing.branch_id;
      if (body.branchId !== undefined) {
        const suppliedBranch = body.branchId === null ? null : uuid(String(body.branchId), "branchId", true)!;
        if (suppliedBranch !== targetBranchId) throw new ApiError("GROUP_SCOPE_IMMUTABLE", "Move a group by creating it in the new scope instead", 409);
      }
    }

    if (!(await hasScopedPermission(auth, "groups.manage", targetBranchId))) {
      throw new ApiError("PERMISSION_DENIED", "You do not have permission to manage groups in this scope", 403);
    }

    const record: Record<string, unknown> = {};
    if (request.method === "POST" || body.name !== undefined) record.name = requiredString(body.name, "name", 160).trim();
    if (body.description !== undefined) record.description = optionalString(body.description, "description", 5000)?.trim() ?? "";
    if (request.method === "POST") record.branch_id = targetBranchId;
    if (body.ministryId !== undefined) record.ministry_id = body.ministryId === null ? null : uuid(String(body.ministryId), "ministryId", true);
    if (body.visibility !== undefined) {
      const visibility = requiredString(body.visibility, "visibility", 20);
      if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "visibility must be members or private", 422);
      record.visibility = visibility;
    }
    const capacity = capacityValue(body.capacity);
    if (capacity !== undefined) record.capacity = capacity;
    const schedule = scheduleValue(body.meetingSchedule);
    if (schedule !== undefined) record.meeting_schedule = schedule;
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new ApiError("VALIDATION_FAILED", "isActive must be boolean", 422);
      record.is_active = body.isActive;
    }

    if (request.method === "POST") {
      Object.assign(record, { organization_id: auth.organizationId, created_by: auth.user.id });
      const { data, error } = await auth.client.from("groups").insert(record).select().single();
      if (error) throw new ApiError("GROUP_CREATE_FAILED", "Unable to create group", 500, undefined, false);
      return { data, status: 201 };
    }

    const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
    const { data, error } = await auth.client
      .from("groups")
      .update(record)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select()
      .single();
    if (error) throw new ApiError("GROUP_UPDATE_FAILED", "Unable to update group", 500, undefined, false);
    return { data };
  },
));
