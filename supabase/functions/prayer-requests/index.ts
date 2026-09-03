import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const statuses = new Set(["submitted", "in_review", "praying", "answered", "closed"]);
const inputPrivacy = new Set(["pastoral_only", "private", "prayer_team", "public_approved", "public_wall", "organization"]);

function toInternalVisibility(value: unknown) {
  const input = optionalString(value, "privacy", 32) ?? "pastoral_only";
  if (!inputPrivacy.has(input)) throw new ApiError("VALIDATION_FAILED", "Invalid confidentiality scope", 422);
  if (input === "pastoral_only" || input === "private") return "private";
  if (input === "prayer_team") return "prayer_team";
  // `organization` is the legacy database enum value used for the General/Public Prayer Wall.
  return "organization";
}

function toExternalPrayer(row: any) {
  const privacy = row.visibility === "private"
    ? "pastoral_only"
    : row.visibility === "prayer_team"
      ? "prayer_team"
      : "public_approved";
  return {
    id: row.id,
    title: row.title,
    request: row.body,
    description: row.body,
    privacy,
    is_confidential: row.visibility === "private",
    is_anonymous: row.is_anonymous === true,
    status: row.status === "closed" ? "archived" : row.status,
    answered_testimony: row.answered_testimony ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function bearer(request: Request) {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError("INVALID_SESSION", "Session is invalid or expired", 401);
  return match[1];
}

async function resolveOrganizationId(request: Request, supplied?: unknown) {
  const raw = typeof supplied === "string" && supplied.trim()
    ? supplied.trim()
    : request.headers.get("x-organization-id") || new URL(request.url).searchParams.get("organizationId");
  const admin = adminClient();

  if (raw) {
    const id = uuid(raw, "organizationId", true)!;
    const { data, error } = await admin.from("organizations").select("id,status").eq("id", id).eq("status", "active").maybeSingle();
    if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "This church is not available for prayer submissions", 404);
    return id;
  }

  // Public single-church deployments should not fail simply because a visitor has
  // no membership header. Resolve automatically only when the deployment has one
  // unambiguous active church; multi-tenant deployments must provide a church id.
  const { data, error } = await admin.from("organizations").select("id").eq("status", "active").order("created_at").limit(2);
  if (error) throw new ApiError("ORGANIZATION_LOOKUP_FAILED", "Unable to resolve the church for this request", 500, undefined, false);
  if ((data ?? []).length === 1) return data![0].id;
  throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church before submitting this prayer request", 422);
}

async function identityFor(request: Request, organizationId: string, requestedBranchId?: string | null) {
  const token = bearer(request);
  if (!token) return { token: null, user: null, client: null, membership: null };

  const client = userClient(token);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new ApiError("INVALID_SESSION", "Session is invalid or expired", 401);

  let query = adminClient()
    .from("memberships")
    .select("id,organization_id,branch_id,status")
    .eq("organization_id", organizationId)
    .eq("profile_id", userData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  if (requestedBranchId) query = query.eq("branch_id", requestedBranchId);
  const { data: memberships, error: membershipError } = await query;
  if (membershipError) throw new ApiError("MEMBERSHIP_LOOKUP_FAILED", "Unable to resolve your church membership", 500, undefined, false);

  return { token, user: userData.user, client, membership: memberships?.[0] ?? null };
}

async function canModerate(client: ReturnType<typeof userClient> | null, organizationId: string, branchId: string | null) {
  if (!client) return false;
  const { data, error } = await client.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_permission: "prayer.moderate",
    target_branch_id: branchId,
  });
  return !error && data === true;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const admin = adminClient();
    const url = new URL(request.url);

    if (request.method === "GET") {
      const organizationId = await resolveOrganizationId(request);
      const identity = await identityFor(request, organizationId, null);
      const moderationView = url.searchParams.get("view") === "moderation";
      const moderator = moderationView && await canModerate(identity.client, organizationId, null);
      if (moderationView && !moderator) throw new ApiError("PERMISSION_DENIED", "Prayer moderation access is required", 403);

      let query = admin
        .from("prayer_requests")
        .select("id,organization_id,branch_id,membership_id,submitted_by_profile_id,title,body,visibility,status,answered_testimony,is_anonymous,created_at,updated_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!moderator) {
        if (identity.user) {
          const membershipId = identity.membership?.id ?? "00000000-0000-0000-0000-000000000000";
          query = query.or(`visibility.eq.organization,submitted_by_profile_id.eq.${identity.user.id},membership_id.eq.${membershipId}`);
        } else {
          query = query.eq("visibility", "organization");
        }
      }

      const { data, error } = await query;
      if (error) throw new ApiError("PRAYER_LIST_FAILED", "Unable to retrieve prayer petitions", 500, undefined, false);
      return { data: (data ?? []).map(toExternalPrayer) };
    }

    const body = assertObject(await jsonBody(request));

    if (request.method === "POST") {
      assertNoUnknownFields(body, [
        "organizationId", "branchId", "title", "body", "request", "visibility", "privacy", "isAnonymous",
      ]);
      const organizationId = await resolveOrganizationId(request, body.organizationId);
      const branchId = body.branchId ? uuid(String(body.branchId), "branchId", true)! : null;
      const identity = await identityFor(request, organizationId, branchId);

      await enforceRateLimit(
        request,
        "prayer_submission",
        `${organizationId}:${identity.user?.id ?? "visitor"}`,
        identity.user ? 20 : 6,
        60 * 60,
      );

      if (branchId && !identity.membership) {
        throw new ApiError("EXPRESSION_ACCESS_DENIED", "Join this Expression before sending a petition specifically to its prayer team", 403);
      }

      const requestText = body.body ?? body.request;
      const privacyValue = body.visibility ?? body.privacy;
      const visibility = toInternalVisibility(privacyValue);
      if (body.isAnonymous !== undefined && typeof body.isAnonymous !== "boolean") {
        throw new ApiError("VALIDATION_FAILED", "isAnonymous must be boolean", 422);
      }

      const record = {
        organization_id: organizationId,
        branch_id: branchId,
        membership_id: identity.membership?.id ?? null,
        submitted_by_profile_id: identity.user?.id ?? null,
        title: requiredString(body.title, "title", 160),
        body: requiredString(requestText, "request", 5000),
        visibility,
        is_anonymous: identity.user ? body.isAnonymous === true : true,
      };

      const { data, error } = await admin.from("prayer_requests").insert(record).select().single();
      if (error) throw new ApiError("PRAYER_CREATE_FAILED", "Unable to submit prayer petition", 500, undefined, false);
      return { data: toExternalPrayer(data), status: 201 };
    }

    assertNoUnknownFields(body, ["id", "organizationId", "status", "answeredTestimony", "visibility", "privacy"]);
    const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
    const { data: existing, error: existingError } = await admin
      .from("prayer_requests")
      .select("id,organization_id,branch_id,membership_id,submitted_by_profile_id")
      .eq("id", id)
      .maybeSingle();
    if (existingError || !existing) throw new ApiError("PRAYER_NOT_FOUND", "Prayer petition not found", 404);

    const identity = await identityFor(request, existing.organization_id, existing.branch_id);
    if (!identity.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Sign in to update a prayer petition", 401);
    const moderator = await canModerate(identity.client, existing.organization_id, existing.branch_id);
    const owner = existing.submitted_by_profile_id === identity.user.id || existing.membership_id === identity.membership?.id;
    if (!moderator && !owner) throw new ApiError("PERMISSION_DENIED", "You do not have permission to update this prayer petition", 403);

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const raw = requiredString(body.status, "status", 20);
      const value = raw === "archived" ? "closed" : raw;
      if (!statuses.has(value)) throw new ApiError("VALIDATION_FAILED", "Invalid prayer status", 422);
      if (!moderator && value !== "answered") throw new ApiError("PERMISSION_DENIED", "Only the pastoral prayer team can change this status", 403);
      updates.status = value;
    }
    if (body.visibility !== undefined || body.privacy !== undefined) {
      if (!moderator) throw new ApiError("PERMISSION_DENIED", "Only the pastoral prayer team can change confidentiality scope", 403);
      updates.visibility = toInternalVisibility(body.visibility ?? body.privacy);
    }
    if (body.answeredTestimony !== undefined) {
      updates.answered_testimony = optionalString(body.answeredTestimony, "answeredTestimony", 5000) ?? null;
    }
    if (!Object.keys(updates).length) throw new ApiError("VALIDATION_FAILED", "At least one update is required", 422);

    const { data, error } = await admin.from("prayer_requests").update(updates).eq("id", id).select().single();
    if (error) throw new ApiError("PRAYER_UPDATE_FAILED", "Unable to update prayer petition", 500, undefined, false);
    return { data: toExternalPrayer(data) };
  },
));
