import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const actions = new Set(["ban", "restore", "restrict_posting", "restore_posting"]);

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

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

        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const profileIds = rows.map((row) => String(row.id)).filter(Boolean);
        const { data: restrictions, error: restrictionError } = profileIds.length
          ? await admin
              .from("platform_user_restrictions")
              .select("profile_id,is_active,reason,expires_at,updated_at")
              .eq("restriction_code", "posting")
              .in("profile_id", profileIds)
          : { data: [], error: null };
        if (restrictionError) throw new ApiError("PLATFORM_USERS_FAILED", "Unable to retrieve posting governance state", 500, undefined, false);

        const restrictionMap = new Map((restrictions ?? []).map((control: any) => [control.profile_id, control]));
        return {
          data: {
            items: rows.map(({ total_count: _total, ...item }) => {
              const control = restrictionMap.get(String(item.id)) as any;
              const stillRestricted = Boolean(
                control?.is_active && (!control.expires_at || new Date(control.expires_at).getTime() > Date.now()),
              );
              return {
                ...item,
                posting_allowed: !stillRestricted,
                posting_restriction_reason: stillRestricted ? control?.reason ?? null : null,
                posting_restricted_until: stillRestricted ? control?.expires_at ?? null : null,
              };
            }),
            page,
            pageSize,
            total: rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0,
          },
        };
      }

      await authorizePlatform(auth, "platform.users.manage");
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["profileId", "action", "reason", "expiresAt"]);
      const profileId = uuid(requiredString(body.profileId, "profileId", 64), "profileId", true)!;
      const action = requiredString(body.action, "action", 32);
      const reason = optionalString(body.reason, "reason", 1000) ?? null;
      if (!actions.has(action)) throw new ApiError("VALIDATION_FAILED", "Unsupported account action", 422);
      if ((action === "ban" || action === "restrict_posting") && !reason) {
        throw new ApiError("VALIDATION_FAILED", "A governance reason is required for this restriction", 422, { reason: "Required" });
      }
      if (profileId === auth.user.id && action === "ban") throw new ApiError("SELF_LOCKOUT_DENIED", "You cannot ban your own platform account", 409);

      if (action === "restrict_posting" || action === "restore_posting") {
        const expiresAt = body.expiresAt === undefined || body.expiresAt === null || body.expiresAt === ""
          ? null
          : new Date(String(body.expiresAt));
        if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new ApiError("VALIDATION_FAILED", "expiresAt must be a valid date/time", 422);

        const { data: control, error: postingError } = await auth.client.rpc("set_platform_user_restriction", {
          target_profile_id: profileId,
          target_restriction: "posting",
          enable_restriction: action === "restrict_posting",
          restriction_reason: action === "restrict_posting" ? reason : "Posting access restored",
          restriction_expires_at: expiresAt?.toISOString() ?? null,
        }).single();
        if (postingError?.code === "P0002") throw new ApiError("PROFILE_NOT_FOUND", "Profile not found", 404);
        if (postingError?.code === "22023") throw new ApiError("VALIDATION_FAILED", postingError.message, 422);
        if (postingError) throw new ApiError("POSTING_GOVERNANCE_FAILED", "Unable to update posting access", 500, undefined, false);
        return {
          data: {
            id: profileId,
            postingAllowed: !control.is_active,
            postingRestrictionReason: control.is_active ? control.reason : null,
            postingRestrictedUntil: control.is_active ? control.expires_at : null,
          },
        };
      }

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
      const { data: updatedUser, error: userError } = await admin.auth.admin.updateUserById(profileId, { ban_duration: banDuration });
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
