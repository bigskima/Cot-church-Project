import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.users.read");
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim().slice(0, 120) || null;
        const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "30") || 30));
        const offset = (page - 1) * pageSize;

        const { data, error } = await auth.client.rpc("platform_identity_directory", {
          query_text: q,
          page_size: pageSize,
          page_offset: offset,
        });
        if (error) throw new ApiError("PLATFORM_USERS_FAILED", "Unable to retrieve platform identities", 500, undefined, false);
        const rows = data ?? [];
        return {
          data: {
            items: rows.map(({ total_count: _total, ...item }: Record<string, unknown>) => item),
            page,
            pageSize,
            total: rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0,
          },
        };
      }

      await authorizePlatform(auth, "platform.users.manage");
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["profileId", "action", "reason"]);
      const profileId = uuid(requiredString(body.profileId, "profileId", 64), "profileId", true)!;
      const action = requiredString(body.action, "action", 32);
      const reason = optionalString(body.reason, "reason", 1000) ?? null;
      if (!new Set(["ban", "restore"]).has(action)) throw new ApiError("VALIDATION_FAILED", "Unsupported account action", 422);
      if (action === "ban" && !reason) throw new ApiError("VALIDATION_FAILED", "A reason is required when banning an account", 422, { reason: "Required" });
      if (profileId === auth.user.id && action === "ban") throw new ApiError("SELF_LOCKOUT_DENIED", "You cannot ban your own platform account", 409);

      const admin = adminClient();
      if (action === "ban") {
        const { count: targetSuperAdminCount } = await admin
          .from("platform_role_assignments")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profileId)
          .eq("role_code", "super_admin")
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        if ((targetSuperAdminCount ?? 0) > 0) {
          const { count: allSuperAdmins } = await admin
            .from("platform_role_assignments")
            .select("id", { count: "exact", head: true })
            .eq("role_code", "super_admin")
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
          if ((allSuperAdmins ?? 0) <= 1) throw new ApiError("LAST_SUPER_ADMIN", "The final active Platform Super Admin cannot be banned", 409);
        }
      }

      const banDuration = action === "ban" ? "876000h" : "none";
      const { data: updatedUser, error: userError } = await admin.auth.admin.updateUserById(profileId, {
        ban_duration: banDuration,
      });
      if (userError || !updatedUser.user) throw new ApiError("PLATFORM_USER_UPDATE_FAILED", "Unable to update platform account", 500, undefined, false);

      const { error: auditError } = await admin.from("platform_audit_log").insert({
        actor_profile_id: auth.user.id,
        action: action === "ban" ? "identity.banned" : "identity.restored",
        target_type: "identity",
        target_id: profileId,
        request_id: requestId,
        metadata: { reason },
      });
      if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Account changed but the governance audit could not be recorded", 500, undefined, false);

      return {
        data: {
          id: updatedUser.user.id,
          email: updatedUser.user.email ?? null,
          bannedUntil: updatedUser.user.banned_until ?? null,
          status: action === "ban" ? "banned" : "active",
        },
      };
    },
  ),
);
