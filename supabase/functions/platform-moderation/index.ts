import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const postingModes = new Set(["open", "closed", "allowlist"]);

type PostingMode = "open" | "closed" | "allowlist";

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
      const admin = adminClient();

      const loadState = async () => {
        const [{ data: policy, error: policyError }, { data: exemptions, error: exemptionsError }] = await Promise.all([
          admin
            .from("platform_public_posting_policy")
            .select("policy_key,mode,reason,updated_by,updated_at")
            .eq("policy_key", "general")
            .maybeSingle(),
          admin
            .from("platform_public_posting_exemptions")
            .select("profile_id,reason,granted_by,created_at,updated_at")
            .order("created_at", { ascending: false })
            .limit(500),
        ]);

        if (policyError || exemptionsError) {
          throw new ApiError("MODERATION_STATE_FAILED", "Unable to load public posting controls", 500, undefined, false);
        }

        const profileIds = (exemptions ?? []).map((item) => item.profile_id).filter(Boolean);
        const { data: profiles, error: profilesError } = profileIds.length
          ? await admin
              .from("profiles")
              .select("id,display_name,username,avatar_url,phone_number")
              .in("id", profileIds)
          : { data: [], error: null };

        if (profilesError) {
          throw new ApiError("MODERATION_STATE_FAILED", "Unable to load approved account details", 500, undefined, false);
        }

        const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        return {
          policy: {
            mode: (policy?.mode ?? "open") as PostingMode,
            reason: policy?.reason ?? "",
            updatedBy: policy?.updated_by ?? null,
            updatedAt: policy?.updated_at ?? null,
          },
          exemptions: (exemptions ?? []).map((item) => {
            const profile = profileMap.get(item.profile_id) as any;
            return {
              profileId: item.profile_id,
              reason: item.reason ?? "",
              grantedBy: item.granted_by ?? null,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              displayName: profile?.display_name ?? null,
              username: profile?.username ?? null,
              avatarUrl: profile?.avatar_url ?? null,
              phoneNumber: profile?.phone_number ?? null,
            };
          }),
        };
      };

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.moderation.read");
        return { data: await loadState() };
      }

      await authorizePlatform(auth, "platform.moderation.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 40);

      if (action === "set_public_posting_policy") {
        assertNoUnknownFields(body, ["action", "mode", "reason"]);
        const mode = requiredString(body.mode, "mode", 20) as PostingMode;
        if (!postingModes.has(mode)) throw new ApiError("VALIDATION_FAILED", "Choose a valid public posting mode", 422);

        const reason = optionalString(body.reason, "reason", 1000) ?? "";
        if (mode !== "open" && reason.trim().length < 3) {
          throw new ApiError("VALIDATION_FAILED", "Add a short reason before restricting public posting", 422, { reason: "Required" });
        }

        const { data: previous, error: previousError } = await admin
          .from("platform_public_posting_policy")
          .select("mode,reason")
          .eq("policy_key", "general")
          .maybeSingle();
        if (previousError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to read the current posting policy", 500, undefined, false);

        const { error: updateError } = await admin
          .from("platform_public_posting_policy")
          .upsert({
            policy_key: "general",
            mode,
            reason: reason.trim(),
            updated_by: auth.user.id,
          }, { onConflict: "policy_key" });
        if (updateError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to update public posting policy", 500, undefined, false);

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "moderation.public_posting_policy_changed",
          target_type: "platform_policy",
          target_id: "general-public-posting",
          request_id: requestId,
          metadata: {
            previousMode: previous?.mode ?? "open",
            newMode: mode,
            previousReason: previous?.reason ?? "",
            reason: reason.trim(),
          },
        });
        if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Posting policy changed but the audit record could not be written", 500, undefined, false);

        return { data: await loadState() };
      }

      if (action === "add_public_posting_exemption") {
        assertNoUnknownFields(body, ["action", "profileId", "reason"]);
        const profileId = uuid(requiredString(body.profileId, "profileId", 64), "profileId", true)!;
        const reason = optionalString(body.reason, "reason", 1000) ?? "";

        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("id")
          .eq("id", profileId)
          .maybeSingle();
        if (profileError || !profile) throw new ApiError("PROFILE_NOT_FOUND", "Account not found", 404);

        const { error: upsertError } = await admin
          .from("platform_public_posting_exemptions")
          .upsert({
            profile_id: profileId,
            reason: reason.trim(),
            granted_by: auth.user.id,
          }, { onConflict: "profile_id" });
        if (upsertError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to approve this account for public posting", 500, undefined, false);

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "moderation.public_posting_exemption_added",
          target_type: "identity",
          target_id: profileId,
          request_id: requestId,
          metadata: { reason: reason.trim() },
        });
        if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Account approval changed but the audit record could not be written", 500, undefined, false);

        return { data: await loadState() };
      }

      if (action === "remove_public_posting_exemption") {
        assertNoUnknownFields(body, ["action", "profileId"]);
        const profileId = uuid(requiredString(body.profileId, "profileId", 64), "profileId", true)!;

        const { error: deleteError } = await admin
          .from("platform_public_posting_exemptions")
          .delete()
          .eq("profile_id", profileId);
        if (deleteError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to remove this public posting approval", 500, undefined, false);

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "moderation.public_posting_exemption_removed",
          target_type: "identity",
          target_id: profileId,
          request_id: requestId,
          metadata: {},
        });
        if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Account approval changed but the audit record could not be written", 500, undefined, false);

        return { data: await loadState() };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported moderation action", 422);
    },
  ),
);
