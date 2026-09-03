import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    if (request.method === "POST") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["invitationId", "decision"]);
      const decision = requiredString(body.decision, "decision", 16).toLowerCase();
      if (!new Set(["accept", "decline"]).has(decision)) throw new ApiError("VALIDATION_FAILED", "Decision must be accept or decline", 422);
      const { data, error } = await auth.client.rpc("respond_governance_invitation", {
        target_invitation_id: uuid(requiredString(body.invitationId, "invitationId", 64), "invitationId", true),
        decision,
      }).single();
      if (error?.code === "P0002") throw new ApiError("INVITATION_NOT_FOUND", "Invitation not found", 404);
      if (error?.code === "42501") throw new ApiError("INVITATION_ACCESS_DENIED", "This invitation does not belong to you", 403);
      if (error?.code === "22023") throw new ApiError("INVITATION_UNAVAILABLE", error.message, 409);
      if (error) throw new ApiError("INVITATION_RESPONSE_FAILED", "Unable to respond to invitation", 500, undefined, false);
      return { data };
    }

    const admin = adminClient();
    const now = new Date().toISOString();
    await admin.from("governance_invitations").update({ status: "expired", responded_at: now })
      .eq("target_profile_id", auth.user.id).eq("status", "pending").lt("expires_at", now);

    const { data: invitations, error } = await admin.from("governance_invitations")
      .select("id,kind,organization_id,branch_id,target_profile_id,target_email,platform_role_code,organization_role_id,invited_by,message,status,expires_at,responded_at,created_at")
      .eq("target_profile_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new ApiError("INVITATION_LIST_FAILED", "Unable to retrieve invitations", 500, undefined, false);

    const branchIds = [...new Set((invitations ?? []).map((item) => item.branch_id).filter(Boolean))] as string[];
    const roleIds = [...new Set((invitations ?? []).map((item) => item.organization_role_id).filter(Boolean))] as string[];
    const inviterIds = [...new Set((invitations ?? []).map((item) => item.invited_by).filter(Boolean))] as string[];
    const platformRoleCodes = [...new Set((invitations ?? []).map((item) => item.platform_role_code).filter(Boolean))] as string[];

    const [branches, roles, inviters, platformRoles] = await Promise.all([
      branchIds.length ? admin.from("branches").select("id,name,code").in("id", branchIds) : Promise.resolve({ data: [], error: null }),
      roleIds.length ? admin.from("roles").select("id,name,code").in("id", roleIds) : Promise.resolve({ data: [], error: null }),
      inviterIds.length ? admin.from("profiles").select("id,display_name,avatar_url").in("id", inviterIds) : Promise.resolve({ data: [], error: null }),
      platformRoleCodes.length ? admin.from("platform_roles").select("code,name").in("code", platformRoleCodes) : Promise.resolve({ data: [], error: null }),
    ]);
    if (branches.error || roles.error || inviters.error || platformRoles.error) throw new ApiError("INVITATION_LIST_FAILED", "Unable to resolve invitation details", 500, undefined, false);

    const branchMap = new Map((branches.data ?? []).map((item: any) => [item.id, item]));
    const roleMap = new Map((roles.data ?? []).map((item: any) => [item.id, item]));
    const inviterMap = new Map((inviters.data ?? []).map((item: any) => [item.id, item]));
    const platformRoleMap = new Map((platformRoles.data ?? []).map((item: any) => [item.code, item]));

    return {
      data: (invitations ?? []).map((item) => ({
        ...item,
        expression: item.branch_id ? branchMap.get(item.branch_id) ?? null : null,
        role: item.organization_role_id ? roleMap.get(item.organization_role_id) ?? null : item.platform_role_code ? platformRoleMap.get(item.platform_role_code) ?? null : null,
        invitedBy: inviterMap.get(item.invited_by) ?? null,
      })),
    };
  },
));
