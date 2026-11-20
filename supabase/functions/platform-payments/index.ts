import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import {
  assertNoUnknownFields,
  assertObject,
  requiredString,
  uuid,
} from "../_shared/validation.ts";

const providerStatuses = new Set(["active", "disabled", "degraded"]);
const environments = new Set(["production", "sandbox"]);
const secretReferencePattern = /^[A-Z][A-Z0-9_]{2,127}$/;
const paymentMethodPattern = /^[a-z][a-z0-9_]{1,39}$/;

function safeSecretReference(value: unknown, field: string) {
  const reference = requiredString(value, field, 128);
  if (!secretReferencePattern.test(reference)) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be a server secret reference name`, 422, {
      [field]: "Use an uppercase environment/Vault reference such as PROVIDER_SECRET_KEY",
    });
  }
  return reference;
}

function currency(value: unknown) {
  const result = requiredString(value, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) {
    throw new ApiError("VALIDATION_FAILED", "currency must be a 3-letter ISO currency code", 422);
  }
  return result;
}

function paymentMethod(value: unknown) {
  const result = requiredString(value, "paymentMethod", 40).toLowerCase();
  if (!paymentMethodPattern.test(result)) {
    throw new ApiError("VALIDATION_FAILED", "Invalid paymentMethod", 422);
  }
  return result;
}

function optionalOrganizationId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return uuid(String(value), "organizationId", true)!;
}

function booleanValue(value: unknown, field: string, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new ApiError("VALIDATION_FAILED", `${field} must be a boolean`, 422);
  }
  return value;
}

function integerValue(value: unknown, field: string, minimum: number, maximum: number, fallback: number) {
  if (value === undefined) return fallback;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an integer between ${minimum} and ${maximum}`, 422);
  }
  return result;
}

function objectValue(value: unknown, field: string) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an object`, 422);
  }
  return value as Record<string, unknown>;
}

async function exactCount(
  query: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
  label: string,
) {
  const { count, error } = await query;
  if (error) {
    throw new ApiError("PLATFORM_PAYMENT_TELEMETRY_FAILED", `Unable to count ${label}`, 500, undefined, false);
  }
  return count ?? 0;
}

async function assertOrganizationExists(organizationId: string | null) {
  if (!organizationId) return;
  const { data, error } = await adminClient()
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "Organization not found", 404);
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.payments.read");
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const [
          providersResult,
          configsResult,
          routesResult,
          attemptsResult,
          eventsResult,
          reconciliationsResult,
          attempts24h,
          succeeded24h,
          failed24h,
          processing24h,
          pendingEvents,
          invalidSignatureEvents,
          activeConfigs,
          activeRoutes,
          reconciliation24h,
          refundPending,
          refundFailed,
        ] = await Promise.all([
          admin
            .from("payment_providers")
            .select("id,code,name,adapter_version,status,capabilities,supported_currencies,created_at,updated_at")
            .order("name", { ascending: true }),
          admin
            .from("payment_provider_configs")
            .select("id,organization_id,provider_id,environment,secret_reference,webhook_secret_reference,is_default,is_active,created_at,updated_at,organizations(id,name,slug)")
            .order("updated_at", { ascending: false }),
          admin
            .from("payment_routing_rules")
            .select("id,organization_id,currency,payment_method,provider_id,priority,is_active,created_at,updated_at,organizations(id,name,slug),payment_providers(id,code,name,status)")
            .order("priority", { ascending: true }),
          admin
            .from("payment_attempts")
            .select("id,organization_id,donation_id,provider,provider_payment_id,amount_minor,currency,status,failure_code,failure_message,created_at,updated_at,organizations(id,name,slug)")
            .order("created_at", { ascending: false })
            .limit(40),
          admin
            .from("payment_provider_events")
            .select("id,provider,provider_event_id,event_type,signature_verified,processing_error,processed_at,received_at")
            .order("received_at", { ascending: false })
            .limit(40),
          admin
            .from("reconciliation_entries")
            .select("id,organization_id,provider,settlement_reference,gross_amount_minor,fee_amount_minor,net_amount_minor,currency,settled_at,created_at,organizations(id,name,slug)")
            .order("settled_at", { ascending: false })
            .limit(30),
          exactCount(admin.from("payment_attempts").select("id", { count: "exact", head: true }).gte("created_at", since24h), "payment attempts in the last 24 hours"),
          exactCount(admin.from("payment_attempts").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("created_at", since24h), "successful payment attempts"),
          exactCount(admin.from("payment_attempts").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h), "failed payment attempts"),
          exactCount(admin.from("payment_attempts").select("id", { count: "exact", head: true }).in("status", ["created", "requires_action", "processing"]).gte("created_at", since24h), "processing payment attempts"),
          exactCount(admin.from("payment_provider_events").select("id", { count: "exact", head: true }).is("processed_at", null), "unprocessed payment webhooks"),
          exactCount(admin.from("payment_provider_events").select("id", { count: "exact", head: true }).eq("signature_verified", false), "unverified payment webhooks"),
          exactCount(admin.from("payment_provider_configs").select("id", { count: "exact", head: true }).eq("is_active", true), "active payment provider configurations"),
          exactCount(admin.from("payment_routing_rules").select("id", { count: "exact", head: true }).eq("is_active", true), "active payment routing rules"),
          exactCount(admin.from("reconciliation_entries").select("id", { count: "exact", head: true }).gte("settled_at", since24h), "reconciliation entries in the last 24 hours"),
          exactCount(admin.from("refunds").select("id", { count: "exact", head: true }).in("status", ["requested", "processing"]), "pending refunds"),
          exactCount(admin.from("refunds").select("id", { count: "exact", head: true }).eq("status", "failed"), "failed refunds"),
        ]);

        for (const result of [
          providersResult,
          configsResult,
          routesResult,
          attemptsResult,
          eventsResult,
          reconciliationsResult,
        ]) {
          if (result.error) {
            throw new ApiError(
              "PLATFORM_PAYMENTS_FAILED",
              "Unable to retrieve payment infrastructure",
              500,
              undefined,
              false,
            );
          }
        }

        const configs = configsResult.data ?? [];
        const providers = (providersResult.data ?? []).map((provider) => ({
          ...provider,
          configurations: configs.filter((config) => config.provider_id === provider.id),
          configured: configs.some((config) => config.provider_id === provider.id),
          activeConfigurationCount: configs.filter(
            (config) => config.provider_id === provider.id && config.is_active,
          ).length,
        }));

        return {
          data: {
            generatedAt: new Date().toISOString(),
            summary: {
              attempts24h,
              succeeded24h,
              failed24h,
              processing24h,
              pendingEvents,
              invalidSignatureEvents,
              activeConfigs,
              activeRoutes,
              reconciliation24h,
              refundPending,
              refundFailed,
            },
            providers,
            routes: routesResult.data ?? [],
            recentAttempts: attemptsResult.data ?? [],
            recentEvents: eventsResult.data ?? [],
            recentReconciliations: reconciliationsResult.data ?? [],
          },
        };
      }

      await authorizePlatform(auth, "platform.payments.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 48);

      if (action === "set_provider_status") {
        assertNoUnknownFields(body, ["action", "providerId", "status", "reason"]);
        const providerId = uuid(requiredString(body.providerId, "providerId", 64), "providerId", true)!;
        const status = requiredString(body.status, "status", 32);
        const reason = requiredString(body.reason, "reason", 1000);
        if (!providerStatuses.has(status)) {
          throw new ApiError("VALIDATION_FAILED", "Invalid payment provider status", 422);
        }

        const { data: current, error: currentError } = await admin
          .from("payment_providers")
          .select("id,code,name,adapter_version,status")
          .eq("id", providerId)
          .maybeSingle();
        if (currentError || !current) throw new ApiError("PAYMENT_PROVIDER_NOT_FOUND", "Payment provider not found", 404);

        if (status === "active") {
          if (current.adapter_version === "legacy") {
            throw new ApiError(
              "PAYMENT_ADAPTER_NOT_READY",
              "This provider is known from legacy payment records but no production adapter is installed",
              409,
            );
          }
          const { data: activeProviderConfigs, error: configError } = await admin
            .from("payment_provider_configs")
            .select("id,secret_reference,webhook_secret_reference")
            .eq("provider_id", providerId)
            .eq("is_active", true);
          if (configError) {
            throw new ApiError("PAYMENT_PROVIDER_CONFIG_FAILED", "Unable to verify provider configuration", 500, undefined, false);
          }
          if (!activeProviderConfigs?.length) {
            throw new ApiError(
              "PAYMENT_PROVIDER_NOT_CONFIGURED",
              "Create and activate a provider configuration before enabling this provider",
              409,
            );
          }
          const missingSecretReference = activeProviderConfigs.find(
            (config) =>
              !Deno.env.get(config.secret_reference)?.trim() ||
              !Deno.env.get(config.webhook_secret_reference)?.trim(),
          );
          if (missingSecretReference) {
            throw new ApiError(
              "PAYMENT_PROVIDER_SECRETS_UNAVAILABLE",
              "The referenced server credentials are not available in the runtime secret store",
              409,
            );
          }
        }

        if (current.status === status) return { data: current };
        const { data, error } = await admin
          .from("payment_providers")
          .update({ status })
          .eq("id", providerId)
          .select("id,code,name,adapter_version,status,capabilities,supported_currencies,updated_at")
          .single();
        if (error) {
          throw new ApiError("PAYMENT_PROVIDER_UPDATE_FAILED", "Unable to change payment provider status", 500, undefined, false);
        }

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "payment.provider_status_updated",
          target_type: "payment_provider",
          target_id: providerId,
          request_id: requestId,
          metadata: {
            code: current.code,
            previousStatus: current.status,
            newStatus: status,
            reason,
          },
        });
        if (auditError) {
          throw new ApiError("PLATFORM_AUDIT_FAILED", "Provider changed but the governance audit could not be recorded", 500, undefined, false);
        }
        return { data };
      }

      if (action === "upsert_provider_config") {
        assertNoUnknownFields(body, [
          "action",
          "providerId",
          "organizationId",
          "environment",
          "secretReference",
          "webhookSecretReference",
          "configuration",
          "isDefault",
          "isActive",
          "reason",
        ]);
        const providerId = uuid(requiredString(body.providerId, "providerId", 64), "providerId", true)!;
        const organizationId = optionalOrganizationId(body.organizationId);
        const environment = requiredString(body.environment, "environment", 20);
        const secretReference = safeSecretReference(body.secretReference, "secretReference");
        const webhookSecretReference = safeSecretReference(body.webhookSecretReference, "webhookSecretReference");
        const configuration = objectValue(body.configuration, "configuration");
        const isDefault = booleanValue(body.isDefault, "isDefault", false);
        const isActive = booleanValue(body.isActive, "isActive", false);
        const reason = requiredString(body.reason, "reason", 1000);
        if (!environments.has(environment)) {
          throw new ApiError("VALIDATION_FAILED", "Invalid payment provider environment", 422);
        }
        await assertOrganizationExists(organizationId);

        const { data: provider, error: providerError } = await admin
          .from("payment_providers")
          .select("id,code")
          .eq("id", providerId)
          .maybeSingle();
        if (providerError || !provider) throw new ApiError("PAYMENT_PROVIDER_NOT_FOUND", "Payment provider not found", 404);

        if (isDefault) {
          let clearDefault = admin
            .from("payment_provider_configs")
            .update({ is_default: false })
            .eq("environment", environment)
            .eq("is_default", true);
          clearDefault = organizationId
            ? clearDefault.eq("organization_id", organizationId)
            : clearDefault.is("organization_id", null);
          const { error: clearError } = await clearDefault;
          if (clearError) {
            throw new ApiError("PAYMENT_PROVIDER_CONFIG_FAILED", "Unable to update default provider configuration", 500, undefined, false);
          }
        }

        const record = {
          organization_id: organizationId,
          provider_id: providerId,
          environment,
          secret_reference: secretReference,
          webhook_secret_reference: webhookSecretReference,
          configuration,
          is_default: isDefault,
          is_active: isActive,
        };
        const { data, error } = await admin
          .from("payment_provider_configs")
          .upsert(record, { onConflict: "organization_id,provider_id,environment" })
          .select("id,organization_id,provider_id,environment,secret_reference,webhook_secret_reference,is_default,is_active,created_at,updated_at")
          .single();
        if (error) {
          throw new ApiError("PAYMENT_PROVIDER_CONFIG_FAILED", "Unable to save payment provider configuration", 500, undefined, false);
        }

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "payment.provider_config_updated",
          target_type: "payment_provider_config",
          target_id: data.id,
          request_id: requestId,
          metadata: {
            providerId,
            providerCode: provider.code,
            organizationId,
            environment,
            isDefault,
            isActive,
            reason,
          },
        });
        if (auditError) {
          throw new ApiError("PLATFORM_AUDIT_FAILED", "Provider configuration changed but the governance audit could not be recorded", 500, undefined, false);
        }
        return { data };
      }

      if (action === "upsert_route") {
        assertNoUnknownFields(body, [
          "action",
          "organizationId",
          "currency",
          "paymentMethod",
          "providerId",
          "priority",
          "isActive",
          "reason",
        ]);
        const organizationId = optionalOrganizationId(body.organizationId);
        const routeCurrency = currency(body.currency);
        const method = paymentMethod(body.paymentMethod);
        const providerId = uuid(requiredString(body.providerId, "providerId", 64), "providerId", true)!;
        const priority = integerValue(body.priority, "priority", 1, 10000, 100);
        const isActive = booleanValue(body.isActive, "isActive", true);
        const reason = requiredString(body.reason, "reason", 1000);
        await assertOrganizationExists(organizationId);

        const { data: provider, error: providerError } = await admin
          .from("payment_providers")
          .select("id,code,status,supported_currencies")
          .eq("id", providerId)
          .maybeSingle();
        if (providerError || !provider) throw new ApiError("PAYMENT_PROVIDER_NOT_FOUND", "Payment provider not found", 404);
        if (isActive && provider.status !== "active") {
          throw new ApiError(
            "PAYMENT_PROVIDER_INACTIVE",
            "An active routing rule can only target an active payment provider",
            409,
          );
        }
        if (
          isActive &&
          Array.isArray(provider.supported_currencies) &&
          provider.supported_currencies.length > 0 &&
          !provider.supported_currencies.includes(routeCurrency)
        ) {
          throw new ApiError(
            "PAYMENT_CURRENCY_UNSUPPORTED",
            `${provider.code} is not registered for ${routeCurrency}`,
            409,
          );
        }

        const { data, error } = await admin
          .from("payment_routing_rules")
          .upsert(
            {
              organization_id: organizationId,
              currency: routeCurrency,
              payment_method: method,
              provider_id: providerId,
              priority,
              is_active: isActive,
            },
            { onConflict: "organization_id,currency,payment_method,provider_id" },
          )
          .select("id,organization_id,currency,payment_method,provider_id,priority,is_active,created_at,updated_at")
          .single();
        if (error) {
          throw new ApiError("PAYMENT_ROUTE_UPDATE_FAILED", "Unable to save payment routing rule", 500, undefined, false);
        }

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "payment.route_updated",
          target_type: "payment_routing_rule",
          target_id: data.id,
          request_id: requestId,
          metadata: {
            organizationId,
            currency: routeCurrency,
            paymentMethod: method,
            providerId,
            providerCode: provider.code,
            priority,
            isActive,
            reason,
          },
        });
        if (auditError) {
          throw new ApiError("PLATFORM_AUDIT_FAILED", "Payment route changed but the governance audit could not be recorded", 500, undefined, false);
        }
        return { data };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported platform payment action", 422);
    },
  ),
);
