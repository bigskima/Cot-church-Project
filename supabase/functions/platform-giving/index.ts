import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const purposeStatuses = new Set(["active", "inactive", "archived"]);

function currency(value: unknown) {
  const result = requiredString(value, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw new ApiError("VALIDATION_FAILED", "Currency must be a 3-letter ISO code", 422);
  return result;
}

function bool(value: unknown, field: string, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new ApiError("VALIDATION_FAILED", `${field} must be a boolean`, 422);
  return value;
}

function int(value: unknown, field: string, fallback = 0) {
  if (value === undefined) return fallback;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < -100000 || result > 100000) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an integer`, 422);
  }
  return result;
}

async function ensureOrganization(id: string) {
  const { data, error } = await adminClient().from("organizations").select("id,name,status").eq("id", id).maybeSingle();
  if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "Church organization not found", 404);
  return data;
}

async function assertOnlinePaymentReady(organizationId: string) {
  const admin = adminClient();
  const { data: routes, error } = await admin
    .from("payment_routing_rules")
    .select("id,provider_id,payment_providers!inner(id,status),payment_provider_configs!payment_routing_rules_provider_id_fkey(id)")
    .eq("is_active", true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .limit(1);
  if (error) throw new ApiError("PAYMENT_READINESS_CHECK_FAILED", "Unable to verify online payment readiness", 500, undefined, false);
  if (!routes?.length) {
    throw new ApiError(
      "ONLINE_GIVING_NOT_READY",
      "Online giving cannot be enabled until a real payment provider configuration and routing rule are active",
      409,
    );
  }
  const { count, error: configError } = await admin
    .from("payment_provider_configs")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);
  if (configError || !count) {
    throw new ApiError(
      "ONLINE_GIVING_NOT_READY",
      "Online giving cannot be enabled until a real payment provider configuration is active",
      409,
    );
  }
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.giving.read");
        const url = new URL(request.url);
        const organizationIdParam = url.searchParams.get("organizationId");
        const organizationId = organizationIdParam ? uuid(organizationIdParam, "organizationId", true)! : null;

        let organizationsQuery = admin.from("organizations").select("id,name,slug,status").order("name", { ascending: true });
        if (organizationId) organizationsQuery = organizationsQuery.eq("id", organizationId);

        let settingsQuery = admin.from("giving_settings").select("*").is("branch_id", null).order("updated_at", { ascending: false });
        let purposesQuery = admin.from("giving_purposes").select("*").is("branch_id", null).order("display_order", { ascending: true }).order("created_at", { ascending: true });
        let accountsQuery = admin.from("organization_bank_accounts").select("*").is("branch_id", null).order("display_order", { ascending: true }).order("created_at", { ascending: true });
        if (organizationId) {
          settingsQuery = settingsQuery.eq("organization_id", organizationId);
          purposesQuery = purposesQuery.eq("organization_id", organizationId);
          accountsQuery = accountsQuery.eq("organization_id", organizationId);
        }

        const [organizations, settings, purposes, accounts] = await Promise.all([
          organizationsQuery,
          settingsQuery,
          purposesQuery,
          accountsQuery,
        ]);
        for (const result of [organizations, settings, purposes, accounts]) {
          if (result.error) throw new ApiError("PLATFORM_GIVING_FAILED", "Unable to retrieve church-wide giving configuration", 500, undefined, false);
        }
        return {
          data: {
            organizations: organizations.data ?? [],
            settings: settings.data ?? [],
            purposes: purposes.data ?? [],
            bankAccounts: accounts.data ?? [],
          },
        };
      }

      await authorizePlatform(auth, "platform.giving.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 48);

      if (action === "upsert_settings") {
        assertNoUnknownFields(body, [
          "action", "organizationId", "displayTitle", "displaySubtitle", "isEnabled",
          "manualTransferEnabled", "onlinePaymentEnabled", "onlineUnavailableMessage", "reason",
        ]);
        const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
        await ensureOrganization(organizationId);
        const onlinePaymentEnabled = bool(body.onlinePaymentEnabled, "onlinePaymentEnabled", false);
        if (onlinePaymentEnabled) await assertOnlinePaymentReady(organizationId);
        const reason = requiredString(body.reason, "reason", 1000);
        const record = {
          organization_id: organizationId,
          branch_id: null,
          display_title: requiredString(body.displayTitle, "displayTitle", 120),
          display_subtitle: optionalString(body.displaySubtitle, "displaySubtitle", 1000) ?? "",
          is_enabled: bool(body.isEnabled, "isEnabled", true),
          manual_transfer_enabled: bool(body.manualTransferEnabled, "manualTransferEnabled", true),
          online_payment_enabled: onlinePaymentEnabled,
          online_unavailable_message: optionalString(body.onlineUnavailableMessage, "onlineUnavailableMessage", 500) ?? "",
          updated_by: auth.user.id,
        };
        const { data: existing } = await admin.from("giving_settings").select("id").eq("organization_id", organizationId).is("branch_id", null).maybeSingle();
        const result = existing
          ? await admin.from("giving_settings").update(record).eq("id", existing.id).select().single()
          : await admin.from("giving_settings").insert({ ...record, created_by: auth.user.id }).select().single();
        if (result.error) throw new ApiError("GIVING_SETTINGS_SAVE_FAILED", "Unable to save church-wide giving settings", 500, undefined, false);
        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "giving.settings_updated",
          target_type: "giving_settings",
          target_id: result.data.id,
          request_id: requestId,
          metadata: { organizationId, reason, scope: "organization" },
        });
        return { data: result.data };
      }

      if (action === "upsert_purpose") {
        assertNoUnknownFields(body, ["action", "id", "organizationId", "name", "description", "status", "displayOrder", "isDefault", "reason"]);
        const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
        await ensureOrganization(organizationId);
        const status = requiredString(body.status ?? "active", "status", 20);
        if (!purposeStatuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid giving purpose status", 422);
        const reason = requiredString(body.reason, "reason", 1000);
        const isDefault = bool(body.isDefault, "isDefault", false);
        if (isDefault) {
          const { error } = await admin.from("giving_purposes").update({ is_default: false }).eq("organization_id", organizationId).is("branch_id", null).eq("is_default", true);
          if (error) throw new ApiError("GIVING_PURPOSE_SAVE_FAILED", "Unable to update default giving purpose", 500, undefined, false);
        }
        const record = {
          organization_id: organizationId,
          branch_id: null,
          name: requiredString(body.name, "name", 160),
          description: optionalString(body.description, "description", 2000) ?? "",
          status,
          display_order: int(body.displayOrder, "displayOrder", 0),
          is_default: isDefault,
          updated_by: auth.user.id,
        };
        const id = body.id ? uuid(requiredString(body.id, "id", 64), "id", true)! : null;
        const result = id
          ? await admin.from("giving_purposes").update(record).eq("id", id).eq("organization_id", organizationId).is("branch_id", null).select().single()
          : await admin.from("giving_purposes").insert({ ...record, created_by: auth.user.id }).select().single();
        if (result.error) throw new ApiError("GIVING_PURPOSE_SAVE_FAILED", "Unable to save church-wide giving purpose", 500, undefined, false);
        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "giving.purpose_updated",
          target_type: "giving_purpose",
          target_id: result.data.id,
          request_id: requestId,
          metadata: { organizationId, reason, scope: "organization" },
        });
        return { data: result.data };
      }

      if (action === "upsert_bank_account") {
        assertNoUnknownFields(body, [
          "action", "id", "organizationId", "label", "bankName", "accountName", "accountNumber",
          "routingNumber", "swiftCode", "iban", "currency", "transferInstructions", "additionalInstructions",
          "referencePrefix", "isPublic", "isActive", "displayOrder", "reason",
        ]);
        const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
        await ensureOrganization(organizationId);
        const reason = requiredString(body.reason, "reason", 1000);
        const record = {
          organization_id: organizationId,
          branch_id: null,
          label: requiredString(body.label, "label", 120),
          bank_name: requiredString(body.bankName, "bankName", 120),
          account_name: requiredString(body.accountName, "accountName", 160),
          account_number: requiredString(body.accountNumber, "accountNumber", 64),
          routing_number: optionalString(body.routingNumber, "routingNumber", 120) ?? null,
          swift_code: optionalString(body.swiftCode, "swiftCode", 120) ?? null,
          iban: optionalString(body.iban, "iban", 160) ?? null,
          currency: currency(body.currency),
          transfer_instructions: optionalString(body.transferInstructions, "transferInstructions", 2000) ?? "",
          additional_instructions: optionalString(body.additionalInstructions, "additionalInstructions", 2000) ?? "",
          reference_prefix: optionalString(body.referencePrefix, "referencePrefix", 80) ?? null,
          is_public: bool(body.isPublic, "isPublic", true),
          is_active: bool(body.isActive, "isActive", true),
          display_order: int(body.displayOrder, "displayOrder", 0),
        };
        const id = body.id ? uuid(requiredString(body.id, "id", 64), "id", true)! : null;
        const result = id
          ? await admin.from("organization_bank_accounts").update(record).eq("id", id).eq("organization_id", organizationId).is("branch_id", null).select().single()
          : await admin.from("organization_bank_accounts").insert({ ...record, created_by: auth.user.id }).select().single();
        if (result.error) throw new ApiError("BANK_ACCOUNT_SAVE_FAILED", "Unable to save church-wide transfer account", 500, undefined, false);
        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "giving.bank_account_updated",
          target_type: "organization_bank_account",
          target_id: result.data.id,
          request_id: requestId,
          metadata: { organizationId, reason, scope: "organization", currency: result.data.currency },
        });
        return { data: result.data };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported church-wide giving action", 422);
    },
  ),
);
