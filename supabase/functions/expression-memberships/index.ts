import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

function optionalBoundedInteger(value: unknown, field: string, minimum: number, maximum: number) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be ${minimum}-${maximum}`, 422, { [field]: "Invalid value" });
  }
  return parsed;
}

function mapInviteError(error: { code?: string; message?: string } | null) {
  if (!error) return null;
  if (error.code === "P0002") return new ApiError("EXPRESSION_INVITE_INVALID", "That invite code is invalid or no longer available", 404);
  if (error.code === "22023") return new ApiError("EXPRESSION_INVITE_UNAVAILABLE", error.message || "That invite code is unavailable", 410);
  if (error.code === "42501") return new ApiError("EXPRESSION_ACCESS_DENIED", "You do not have access to this Expression", 403);
  return new ApiError("EXPRESSION_MEMBERSHIP_FAILED", "Unable to complete Expression membership request", 500, undefined, false);
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "DELETE"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    const url = new URL(request.url);

    if (request.method === "GET") {
      const view = url.searchParams.get("view") ?? "memberships";
      if (view === "memberships") {
        const { data, error } = await auth.client
          .from("expression_memberships")
          .select("id,organization_id,branch_id,status,joined_at,branch:branches(id,name,code,timezone,is_active,organization:organizations(id,name,slug,status))")
          .eq("profile_id", auth.user.id)
          .eq("status", "active")
          .order("joined_at", { ascending: true });
        if (error) throw new ApiError("EXPRESSION_MEMBERSHIPS_FAILED", "Unable to load your Expressions", 500, undefined, false);
        return { data: data ?? [] };
      }

      if (view === "codes") {
        if (!auth.organizationId || !auth.branchId) throw new ApiError("EXPRESSION_REQUIRED", "Enter an Expression first", 400);
        await authorize(auth, "members.invite");
        const { data, error } = await auth.client
          .from("expression_invite_codes")
          .select("id,code_hint,status,expires_at,usage_limit,usage_count,created_at,revoked_at")
          .eq("organization_id", auth.organizationId)
          .eq("branch_id", auth.branchId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You do not have permission to manage invite codes", 403);
        if (error) throw new ApiError("EXPRESSION_INVITE_LIST_FAILED", "Unable to load invite codes", 500, undefined, false);
        return {
          data: (data ?? []).map((code) => ({
            ...code,
            status: code.status === "active" && code.expires_at && Date.parse(code.expires_at) <= Date.now()
              ? "expired"
              : code.status,
          })),
        };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported Expression membership view", 422);
    }

    const body = assertObject(await jsonBody(request));
    if (request.method === "DELETE") {
      assertNoUnknownFields(body, ["codeId"]);
      const { error } = await auth.client.rpc("revoke_expression_invite_code", {
        target_code_id: uuid(requiredString(body.codeId, "codeId", 36), "codeId", true),
      });
      if (error) throw mapInviteError(error);
      return { data: { status: "revoked" } };
    }

    const action = requiredString(body.action, "action", 32);
    if (action === "preview") {
      assertNoUnknownFields(body, ["action", "code"]);
      const code = requiredString(body.code, "code", 64);
      await enforceRateLimit(request, "expression-invite-preview", auth.user.id, 20, 900);
      const { data, error } = await auth.client.rpc("preview_expression_invite_code", { raw_code: code }).single();
      if (error) throw mapInviteError(error);
      return { data };
    }

    if (action === "redeem") {
      assertNoUnknownFields(body, ["action", "code"]);
      const code = requiredString(body.code, "code", 64);
      await enforceRateLimit(request, "expression-invite-redeem", auth.user.id, 10, 900);
      const { data, error } = await auth.client.rpc("redeem_expression_invite_code", { raw_code: code }).single();
      if (error) throw mapInviteError(error);
      return { data };
    }

    if (action === "generate") {
      assertNoUnknownFields(body, ["action", "validityHours", "usageLimit"]);
      if (!auth.organizationId || !auth.branchId) throw new ApiError("EXPRESSION_REQUIRED", "Enter an Expression first", 400);
      await authorize(auth, "members.invite");
      const validityHours = optionalBoundedInteger(body.validityHours, "validityHours", 1, 2160) ?? 168;
      const usageLimit = optionalBoundedInteger(body.usageLimit, "usageLimit", 1, 100000);
      const { data, error } = await auth.client.rpc("generate_expression_invite_code", {
        target_organization_id: auth.organizationId,
        target_branch_id: auth.branchId,
        validity_hours: validityHours,
        maximum_uses: usageLimit,
      }).single();
      if (error) throw mapInviteError(error);
      const generated = data as unknown as { id: string; invite_code: string; code_hint: string; expires_at: string | null; usage_limit: number | null };
      return {
        data: {
          id: generated.id,
          inviteCode: generated.invite_code,
          codeHint: generated.code_hint,
          expiresAt: generated.expires_at,
          usageLimit: generated.usage_limit,
        },
        status: 201,
      };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported Expression membership action", 422);
  },
));
