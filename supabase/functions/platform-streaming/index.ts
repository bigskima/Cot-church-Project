import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { loadStreamingConfig } from "../_shared/streaming/configuration.ts";
import { streamingProvider } from "../_shared/streaming/registry.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

function secretReference(value: unknown, field: string, required = false) {
  if ((value === undefined || value === null || value === "") && !required) return null;
  const reference = requiredString(value, field, 128);
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(reference)) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an environment/Vault secret reference`, 422, {
      [field]: "Use an uppercase secret name such as MUX_API_CREDENTIALS; never send the secret value.",
    });
  }
  return reference;
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.streaming.read");
        const [providersResult, configsResult, streamsResult, webhookResult] = await Promise.all([
          admin
            .from("streaming_providers")
            .select("id,code,name,adapter_version,capabilities,is_active,created_at,updated_at")
            .order("name", { ascending: true }),
          admin
            .from("streaming_provider_configs")
            .select("id,provider_id,secret_reference,webhook_secret_reference,signing_key_reference,configuration,is_default,is_active,created_at,updated_at,streaming_providers(id,code,name,adapter_version,capabilities,is_active)")
            .is("organization_id", null)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true }),
          admin
            .from("live_streams")
            .select("id,organization_id,branch_id,title,status,latency_mode,scheduled_start,started_at,ended_at,provider_config_id,provider_broadcast_id,lifecycle_error,organizations(id,name,slug),branches(id,name,code)")
            .in("status", ["scheduled", "provisioning", "ready", "live", "processing", "failed"])
            .order("created_at", { ascending: false })
            .limit(100),
          admin
            .from("live_webhook_events")
            .select("id,provider_id,event_type,signature_valid,received_at,processed_at,processing_error")
            .order("received_at", { ascending: false })
            .limit(30),
        ]);

        if (providersResult.error || configsResult.error || streamsResult.error || webhookResult.error) {
          throw new ApiError("PLATFORM_STREAMING_FAILED", "Unable to retrieve streaming control-plane telemetry", 500, undefined, false);
        }

        return {
          data: {
            providers: providersResult.data ?? [],
            globalConfigs: configsResult.data ?? [],
            streams: streamsResult.data ?? [],
            recentWebhooks: webhookResult.data ?? [],
          },
        };
      }

      await authorizePlatform(auth, "platform.streaming.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 48);

      if (action === "set_provider_active") {
        assertNoUnknownFields(body, ["action", "providerId", "isActive", "reason"]);
        const providerId = uuid(requiredString(body.providerId, "providerId", 64), "providerId", true)!;
        if (typeof body.isActive !== "boolean") throw new ApiError("VALIDATION_FAILED", "isActive must be a boolean", 422);
        const reason = optionalString(body.reason, "reason", 1000) ?? null;
        if (body.isActive === false && !reason) {
          throw new ApiError("VALIDATION_FAILED", "A governance reason is required when disabling a provider", 422, { reason: "Required" });
        }

        const { data: current, error: currentError } = await admin
          .from("streaming_providers")
          .select("id,code,name,is_active")
          .eq("id", providerId)
          .maybeSingle();
        if (currentError || !current) throw new ApiError("STREAMING_PROVIDER_NOT_FOUND", "Streaming provider not found", 404);

        const { data: updated, error: updateError } = await admin
          .from("streaming_providers")
          .update({ is_active: body.isActive })
          .eq("id", providerId)
          .select("id,code,name,adapter_version,capabilities,is_active,updated_at")
          .single();
        if (updateError) throw new ApiError("STREAMING_PROVIDER_UPDATE_FAILED", "Unable to update streaming provider", 500, undefined, false);

        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: body.isActive ? "streaming.provider_enabled" : "streaming.provider_disabled",
          target_type: "streaming_provider",
          target_id: providerId,
          request_id: requestId,
          metadata: { providerCode: current.code, previousActive: current.is_active, newActive: body.isActive, reason },
        });
        return { data: updated };
      }

      if (action === "configure_global") {
        assertNoUnknownFields(body, [
          "action",
          "providerId",
          "secretReference",
          "webhookSecretReference",
          "signingKeyReference",
          "configuration",
          "isDefault",
          "isActive",
        ]);
        const providerId = uuid(requiredString(body.providerId, "providerId", 64), "providerId", true)!;
        const secret = secretReference(body.secretReference, "secretReference", true)!;
        const webhookSecret = secretReference(body.webhookSecretReference, "webhookSecretReference", true)!;
        const signingKey = secretReference(body.signingKeyReference, "signingKeyReference", false);
        if (body.configuration !== undefined && (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration))) {
          throw new ApiError("VALIDATION_FAILED", "configuration must be an object", 422);
        }
        const isDefault = body.isDefault === undefined ? false : body.isDefault;
        const isActive = body.isActive === undefined ? true : body.isActive;
        if (typeof isDefault !== "boolean" || typeof isActive !== "boolean") {
          throw new ApiError("VALIDATION_FAILED", "isDefault and isActive must be booleans", 422);
        }

        const { data: provider, error: providerError } = await admin
          .from("streaming_providers")
          .select("id,code,name,is_active")
          .eq("id", providerId)
          .maybeSingle();
        if (providerError || !provider) throw new ApiError("STREAMING_PROVIDER_NOT_FOUND", "Streaming provider not found", 404);
        if (!provider.is_active && isActive) throw new ApiError("STREAMING_PROVIDER_DISABLED", "Enable the provider before activating its global configuration", 409);

        if (isDefault) {
          const { error } = await admin
            .from("streaming_provider_configs")
            .update({ is_default: false })
            .is("organization_id", null)
            .neq("provider_id", providerId);
          if (error) throw new ApiError("STREAMING_CONFIG_UPDATE_FAILED", "Unable to rotate the default streaming provider", 500, undefined, false);
        }

        const record = {
          organization_id: null,
          provider_id: providerId,
          secret_reference: secret,
          webhook_secret_reference: webhookSecret,
          signing_key_reference: signingKey,
          configuration: body.configuration ?? {},
          is_default: isDefault,
          is_active: isActive,
        };

        const { data: existing } = await admin
          .from("streaming_provider_configs")
          .select("id")
          .is("organization_id", null)
          .eq("provider_id", providerId)
          .maybeSingle();

        const query = existing?.id
          ? admin.from("streaming_provider_configs").update(record).eq("id", existing.id)
          : admin.from("streaming_provider_configs").insert(record);
        const { data: saved, error: saveError } = await query
          .select("id,provider_id,secret_reference,webhook_secret_reference,signing_key_reference,configuration,is_default,is_active,created_at,updated_at")
          .single();
        if (saveError) throw new ApiError("STREAMING_CONFIG_UPDATE_FAILED", "Unable to save global streaming configuration", 500, undefined, false);

        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "streaming.global_configuration_saved",
          target_type: "streaming_provider_config",
          target_id: saved.id,
          request_id: requestId,
          metadata: { providerCode: provider.code, isDefault, isActive, secretReferencesOnly: true },
        });
        return { data: saved };
      }

      if (action === "terminate_stream") {
        assertNoUnknownFields(body, ["action", "streamId", "reason"]);
        const streamId = uuid(requiredString(body.streamId, "streamId", 64), "streamId", true)!;
        const reason = requiredString(body.reason, "reason", 1000);
        const { data: stream, error: streamError } = await admin
          .from("live_streams")
          .select("id,organization_id,title,status,provider_config_id,provider_broadcast_id")
          .eq("id", streamId)
          .maybeSingle();
        if (streamError || !stream) throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);
        if (!stream.provider_config_id || !stream.provider_broadcast_id) {
          throw new ApiError("STREAM_PROVIDER_STATE_INVALID", "Broadcast does not have a provider session that can be terminated", 409);
        }

        const loaded = await loadStreamingConfig(stream.provider_config_id);
        const adapter = streamingProvider(loaded.provider.providerCode);
        await adapter.stopBroadcast(loaded.provider, stream.provider_broadcast_id);
        const endedAt = new Date().toISOString();
        const { data: updated, error: updateError } = await admin
          .from("live_streams")
          .update({ status: "ended", ended_at: endedAt, lifecycle_error: null })
          .eq("id", streamId)
          .select("id,title,status,ended_at")
          .single();
        if (updateError) throw new ApiError("STREAM_TERMINATION_STATE_FAILED", "Provider stopped the broadcast but the platform state could not be finalized", 500, undefined, false);

        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "streaming.emergency_terminated",
          target_type: "live_stream",
          target_id: streamId,
          request_id: requestId,
          metadata: { organizationId: stream.organization_id, title: stream.title, previousStatus: stream.status, reason },
        });
        return { data: updated };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported platform streaming action", 422);
    },
  ),
);
