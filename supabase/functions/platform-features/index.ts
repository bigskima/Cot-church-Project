import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

function rollout(value: unknown, field = "rolloutPercentage") {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an integer between 0 and 100`, 422);
  }
  return number;
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.features.read");
        const url = new URL(request.url);
        const organizationParam = url.searchParams.get("organizationId");
        const organizationId = organizationParam ? uuid(organizationParam, "organizationId", true) : null;

        const [flagsResult, overridesResult] = await Promise.all([
          admin
            .from("platform_feature_flags")
            .select("key,name,category,description,global_enabled,rollout_percentage,configuration,created_at,updated_at")
            .order("category", { ascending: true })
            .order("name", { ascending: true }),
          organizationId
            ? admin
                .from("organization_feature_overrides")
                .select("organization_id,feature_key,enabled,rollout_percentage,configuration,reason,updated_at")
                .eq("organization_id", organizationId)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (flagsResult.error || overridesResult.error) {
          throw new ApiError("PLATFORM_FEATURES_FAILED", "Unable to retrieve platform feature state", 500, undefined, false);
        }

        const overrides = new Map((overridesResult.data ?? []).map((item) => [item.feature_key, item]));
        const items = (flagsResult.data ?? []).map((flag) => {
          const override = overrides.get(flag.key);
          return {
            ...flag,
            organization_override: override ?? null,
            effective_enabled: override?.enabled ?? flag.global_enabled,
            effective_rollout_percentage: override?.rollout_percentage ?? flag.rollout_percentage,
          };
        });

        return { data: { organizationId, items } };
      }

      await authorizePlatform(auth, "platform.features.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 48);

      if (action === "set_global") {
        assertNoUnknownFields(body, ["action", "key", "enabled", "rolloutPercentage", "configuration", "reason"]);
        const key = requiredString(body.key, "key", 96);
        if (typeof body.enabled !== "boolean") throw new ApiError("VALIDATION_FAILED", "enabled must be a boolean", 422);
        const rolloutPercentage = rollout(body.rolloutPercentage);
        const reason = optionalString(body.reason, "reason", 1000) ?? null;
        if (!body.enabled && !reason) {
          throw new ApiError("VALIDATION_FAILED", "A governance reason is required when globally disabling a feature", 422, { reason: "Required" });
        }
        if (body.configuration !== undefined && (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration))) {
          throw new ApiError("VALIDATION_FAILED", "configuration must be an object", 422);
        }

        const { data: current, error: currentError } = await admin
          .from("platform_feature_flags")
          .select("key,name,global_enabled,rollout_percentage,configuration")
          .eq("key", key)
          .maybeSingle();
        if (currentError || !current) throw new ApiError("FEATURE_NOT_FOUND", "Feature flag not found", 404);

        const updates: Record<string, unknown> = {
          global_enabled: body.enabled,
          rollout_percentage: rolloutPercentage,
          updated_by: auth.user.id,
        };
        if (body.configuration !== undefined) updates.configuration = body.configuration;

        const { data: updated, error } = await admin
          .from("platform_feature_flags")
          .update(updates)
          .eq("key", key)
          .select("key,name,category,description,global_enabled,rollout_percentage,configuration,updated_at")
          .single();
        if (error) throw new ApiError("FEATURE_UPDATE_FAILED", "Unable to update global feature state", 500, undefined, false);

        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "feature.global_updated",
          target_type: "platform_feature_flag",
          target_id: null,
          request_id: requestId,
          metadata: {
            key,
            previousEnabled: current.global_enabled,
            newEnabled: body.enabled,
            previousRolloutPercentage: current.rollout_percentage,
            newRolloutPercentage: rolloutPercentage,
            reason,
          },
        });
        return { data: updated };
      }

      if (action === "set_organization_override") {
        assertNoUnknownFields(body, ["action", "organizationId", "key", "enabled", "rolloutPercentage", "configuration", "reason"]);
        const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
        const key = requiredString(body.key, "key", 96);
        const enabled = body.enabled === null || body.enabled === undefined ? null : body.enabled;
        if (enabled !== null && typeof enabled !== "boolean") throw new ApiError("VALIDATION_FAILED", "enabled must be a boolean or null", 422);
        const rolloutPercentage = body.rolloutPercentage === null || body.rolloutPercentage === undefined
          ? null
          : rollout(body.rolloutPercentage);
        const reason = requiredString(body.reason, "reason", 1000);
        if (body.configuration !== undefined && (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration))) {
          throw new ApiError("VALIDATION_FAILED", "configuration must be an object", 422);
        }

        const [{ data: organization }, { data: flag }] = await Promise.all([
          admin.from("organizations").select("id,name,status").eq("id", organizationId).maybeSingle(),
          admin.from("platform_feature_flags").select("key,name").eq("key", key).maybeSingle(),
        ]);
        if (!organization) throw new ApiError("ORGANIZATION_NOT_FOUND", "Organization not found", 404);
        if (!flag) throw new ApiError("FEATURE_NOT_FOUND", "Feature flag not found", 404);

        const { data: saved, error } = await admin
          .from("organization_feature_overrides")
          .upsert({
            organization_id: organizationId,
            feature_key: key,
            enabled,
            rollout_percentage: rolloutPercentage,
            configuration: body.configuration ?? {},
            reason,
            updated_by: auth.user.id,
          }, { onConflict: "organization_id,feature_key" })
          .select()
          .single();
        if (error) throw new ApiError("FEATURE_OVERRIDE_UPDATE_FAILED", "Unable to save organization feature override", 500, undefined, false);

        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "feature.organization_override_saved",
          target_type: "organization",
          target_id: organizationId,
          request_id: requestId,
          metadata: { organizationName: organization.name, featureKey: key, enabled, rolloutPercentage, reason },
        });
        return { data: saved };
      }

      if (action === "clear_organization_override") {
        assertNoUnknownFields(body, ["action", "organizationId", "key", "reason"]);
        const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
        const key = requiredString(body.key, "key", 96);
        const reason = requiredString(body.reason, "reason", 1000);
        const { error } = await admin
          .from("organization_feature_overrides")
          .delete()
          .eq("organization_id", organizationId)
          .eq("feature_key", key);
        if (error) throw new ApiError("FEATURE_OVERRIDE_DELETE_FAILED", "Unable to clear organization feature override", 500, undefined, false);

        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "feature.organization_override_cleared",
          target_type: "organization",
          target_id: organizationId,
          request_id: requestId,
          metadata: { featureKey: key, reason },
        });
        return { data: { organizationId, key, cleared: true } };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported platform feature action", 422);
    },
  ),
);
