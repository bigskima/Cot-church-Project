import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const campaignStatuses = new Set(["draft", "active", "paused", "completed", "archived"]);
const purposeStatuses = new Set(["active", "inactive", "archived"]);

function currency(value: unknown) {
  const result = requiredString(value, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw new ApiError("VALIDATION_FAILED", "Currency must be a 3-letter ISO code", 422);
  return result;
}

function amount(value: unknown, field = "amountMinor") {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > 100000000000) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be a positive safe integer`, 422);
  }
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

function requireExpression(branchId: string | null) {
  if (!branchId) throw new ApiError("EXPRESSION_REQUIRED", "Select an expression to manage expression giving", 400);
  return branchId;
}

async function canManageGivingScope(auth: any, organizationId: string, branchId: string | null) {
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_permission: "giving.campaigns.manage",
    target_branch_id: branchId,
  });
  if (error) throw new ApiError("GIVING_PERMISSION_CHECK_FAILED", "Unable to verify giving access", 500, undefined, false);
  return data === true;
}

async function requireGivingScope(auth: any, organizationId: string, branchId: string | null) {
  if (!(await canManageGivingScope(auth, organizationId, branchId))) {
    throw new ApiError("PERMISSION_DENIED", "You do not have permission to manage this giving destination", 403);
  }
}

Deno.serve(
  createHandler(
    { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
    async ({ request, auth }) => {
      if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
      const organizationId = auth.organizationId;
      const url = new URL(request.url);

      if (request.method === "GET") {
        const view = url.searchParams.get("view") ?? "campaigns";
        if (!new Set(["management-scopes", "configuration", "campaigns", "donations", "receipts"]).has(view)) {
          throw new ApiError("VALIDATION_FAILED", "Invalid giving view", 422);
        }

        if (view === "management-scopes") {
          const [organizationScope, expressionScope] = await Promise.all([
            canManageGivingScope(auth, organizationId, null),
            auth.branchId ? canManageGivingScope(auth, organizationId, auth.branchId) : Promise.resolve(false),
          ]);
          return {
            data: {
              organization: organizationScope,
              expression: expressionScope,
              expressionId: auth.branchId ?? null,
            },
          };
        }

        if (view === "donations") {
          const { data, error } = await auth.client
            .from("donations")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("donor_profile_id", auth.user.id)
            .order("created_at", { ascending: false })
            .limit(100);
          if (error) throw new ApiError("GIVING_LIST_FAILED", "Unable to retrieve giving records", 500, undefined, false);
          return { data: data ?? [] };
        }

        if (view === "receipts") {
          const { data, error } = await auth.client
            .from("receipts")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("issued_to_profile_id", auth.user.id)
            .order("issued_at", { ascending: false })
            .limit(100);
          if (error) throw new ApiError("GIVING_LIST_FAILED", "Unable to retrieve giving receipts", 500, undefined, false);
          return { data: data ?? [] };
        }

        const requestedScope = url.searchParams.get("scope") === "organization" ? "organization" : "expression";
        const targetBranchId = requestedScope === "organization" ? null : requireExpression(auth.branchId);

        if (view === "campaigns") {
          let campaignQuery = auth.client
            .from("giving_campaigns")
            .select("*")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(100);
          campaignQuery = targetBranchId ? campaignQuery.eq("branch_id", targetBranchId) : campaignQuery.is("branch_id", null);
          const { data, error } = await campaignQuery;
          if (error) throw new ApiError("GIVING_LIST_FAILED", "Unable to retrieve giving campaigns", 500, undefined, false);
          return { data: data ?? [] };
        }

        await requireGivingScope(auth, organizationId, targetBranchId);
        let settingsQuery = auth.client.from("giving_settings").select("*").eq("organization_id", organizationId);
        let purposesQuery = auth.client.from("giving_purposes").select("*").eq("organization_id", organizationId).order("display_order", { ascending: true });
        let accountsQuery = auth.client.from("organization_bank_accounts").select("*").eq("organization_id", organizationId).order("display_order", { ascending: true });
        let campaignsQuery = auth.client.from("giving_campaigns").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
        if (targetBranchId) {
          settingsQuery = settingsQuery.eq("branch_id", targetBranchId);
          purposesQuery = purposesQuery.eq("branch_id", targetBranchId);
          accountsQuery = accountsQuery.eq("branch_id", targetBranchId);
          campaignsQuery = campaignsQuery.eq("branch_id", targetBranchId);
        } else {
          settingsQuery = settingsQuery.is("branch_id", null);
          purposesQuery = purposesQuery.is("branch_id", null);
          accountsQuery = accountsQuery.is("branch_id", null);
          campaignsQuery = campaignsQuery.is("branch_id", null);
        }
        const [settings, purposes, accounts, campaigns] = await Promise.all([
          settingsQuery.maybeSingle(),
          purposesQuery,
          accountsQuery,
          campaignsQuery,
        ]);
        for (const result of [settings, purposes, accounts, campaigns]) {
          if (result.error) throw new ApiError("GIVING_CONFIGURATION_FAILED", "Unable to retrieve giving configuration", 500, undefined, false);
        }
        return {
          data: {
            settings: settings.data ?? null,
            purposes: purposes.data ?? [],
            bankAccounts: accounts.data ?? [],
            campaigns: campaigns.data ?? [],
          },
        };
      }

      const body = assertObject(await jsonBody(request));
      const action = body.action ? requiredString(body.action, "action", 48) : null;

      if (action === "donate") {
        assertNoUnknownFields(body, ["action", "campaignId", "amountMinor", "currency", "provider", "idempotencyKey", "anonymous", "note"]);
        const expressionId = auth.branchId;
        let settingsQuery = auth.client.from("giving_settings").select("online_payment_enabled,is_enabled").eq("organization_id", organizationId);
        settingsQuery = expressionId ? settingsQuery.eq("branch_id", expressionId) : settingsQuery.is("branch_id", null);
        const { data: settings } = await settingsQuery.maybeSingle();
        if (!settings?.is_enabled || !settings.online_payment_enabled) {
          throw new ApiError("ONLINE_GIVING_UNAVAILABLE", "Online giving is not available for this giving destination", 409);
        }
        const { data, error } = await auth.client.rpc("create_donation_intent", {
          target_organization_id: organizationId,
          target_branch_id: expressionId,
          target_campaign_id: body.campaignId ? uuid(String(body.campaignId), "campaignId", true) : null,
          target_amount_minor: amount(body.amountMinor),
          target_currency: currency(body.currency),
          target_provider: requiredString(body.provider, "provider", 50),
          target_idempotency_key: requiredString(body.idempotencyKey, "idempotencyKey", 128),
          make_anonymous: body.anonymous === true,
          donor_message: optionalString(body.note, "note", 1000) ?? "",
        }).single();
        if (error?.code === "23514") throw new ApiError("IDEMPOTENCY_CONFLICT", "Idempotency key conflict", 409);
        if (error) throw new ApiError("DONATION_INTENT_FAILED", "Unable to create donation intent", 500, undefined, false);
        return { data, status: 201 };
      }

      const requestedScope = url.searchParams.get("scope") === "organization" ? "organization" : "expression";
      const expressionId = requestedScope === "organization" ? null : requireExpression(auth.branchId);
      await requireGivingScope(auth, organizationId, expressionId);

      if (action === "upsert_settings") {
        assertNoUnknownFields(body, [
          "action", "displayTitle", "displaySubtitle", "isEnabled", "manualTransferEnabled",
          "onlinePaymentEnabled", "onlineUnavailableMessage",
        ]);
        if (body.onlinePaymentEnabled === true) {
          throw new ApiError(
            "ONLINE_GIVING_NOT_READY",
            "Online giving is not available for this giving destination yet",
            409,
          );
        }
        const record = {
          organization_id: organizationId,
          branch_id: expressionId,
          display_title: requiredString(body.displayTitle, "displayTitle", 120),
          display_subtitle: optionalString(body.displaySubtitle, "displaySubtitle", 1000) ?? "",
          is_enabled: bool(body.isEnabled, "isEnabled", true),
          manual_transfer_enabled: bool(body.manualTransferEnabled, "manualTransferEnabled", true),
          online_payment_enabled: false,
          online_unavailable_message: optionalString(body.onlineUnavailableMessage, "onlineUnavailableMessage", 500) ?? "",
          updated_by: auth.user.id,
        };
        let existingQuery = auth.client
          .from("giving_settings")
          .select("id")
          .eq("organization_id", organizationId);
        existingQuery = expressionId ? existingQuery.eq("branch_id", expressionId) : existingQuery.is("branch_id", null);
        const { data: existing } = await existingQuery.maybeSingle();
        const result = existing
          ? await auth.client.from("giving_settings").update(record).eq("id", existing.id).select().single()
          : await auth.client.from("giving_settings").insert({ ...record, created_by: auth.user.id }).select().single();
        if (result.error) throw new ApiError("GIVING_SETTINGS_SAVE_FAILED", "Unable to save giving settings", 500, undefined, false);
        return { data: result.data };
      }

      if (action === "upsert_purpose") {
        assertNoUnknownFields(body, ["action", "id", "name", "description", "status", "displayOrder", "isDefault"]);
        const status = requiredString(body.status ?? "active", "status", 20);
        if (!purposeStatuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid purpose status", 422);
        const isDefault = bool(body.isDefault, "isDefault", false);
        if (isDefault) {
          const { error } = await auth.client
            .from("giving_purposes")
            .update({ is_default: false, updated_by: auth.user.id })
            .eq("organization_id", organizationId)
            .eq("branch_id", expressionId)
            .eq("is_default", true);
          if (error) throw new ApiError("GIVING_PURPOSE_SAVE_FAILED", "Unable to update default purpose", 500, undefined, false);
        }
        const record = {
          organization_id: organizationId,
          branch_id: expressionId,
          name: requiredString(body.name, "name", 160),
          description: optionalString(body.description, "description", 2000) ?? "",
          status,
          display_order: int(body.displayOrder, "displayOrder", 0),
          is_default: isDefault,
          updated_by: auth.user.id,
        };
        const id = body.id ? uuid(requiredString(body.id, "id", 64), "id", true)! : null;
        const result = id
          ? await auth.client.from("giving_purposes").update(record).eq("id", id).eq("organization_id", organizationId).select().single()
          : await auth.client.from("giving_purposes").insert({ ...record, created_by: auth.user.id }).select().single();
        if (result.error) throw new ApiError("GIVING_PURPOSE_SAVE_FAILED", "Unable to save giving purpose", 500, undefined, false);
        return { data: result.data };
      }

      if (action === "upsert_bank_account") {
        assertNoUnknownFields(body, [
          "action", "id", "label", "bankName", "accountName", "accountNumber", "routingNumber", "swiftCode",
          "iban", "currency", "transferInstructions", "additionalInstructions", "referencePrefix",
          "isPublic", "isActive", "displayOrder",
        ]);
        const record = {
          organization_id: organizationId,
          branch_id: expressionId,
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
          ? await auth.client.from("organization_bank_accounts").update(record).eq("id", id).eq("organization_id", organizationId).select().single()
          : await auth.client.from("organization_bank_accounts").insert({ ...record, created_by: auth.user.id }).select().single();
        if (result.error) throw new ApiError("BANK_ACCOUNT_SAVE_FAILED", "Unable to save transfer account", 500, undefined, false);
        return { data: result.data };
      }

      if (action === "upsert_campaign" || !action) {
        assertNoUnknownFields(body, ["action", "id", "name", "description", "status", "currency", "goalAmountMinor", "startsAt", "endsAt"]);
        const record: Record<string, unknown> = {
          organization_id: organizationId,
          branch_id: expressionId,
        };
        if (request.method === "POST" || body.name !== undefined) record.name = requiredString(body.name, "name", 180);
        if (body.description !== undefined) record.description = optionalString(body.description, "description", 10000) ?? "";
        if (request.method === "POST" || body.currency !== undefined) record.currency = currency(body.currency);
        if (body.goalAmountMinor !== undefined) record.goal_amount_minor = body.goalAmountMinor === null ? null : amount(body.goalAmountMinor, "goalAmountMinor");
        if (body.status !== undefined) {
          const status = requiredString(body.status, "status", 20);
          if (!campaignStatuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid campaign status", 422);
          record.status = status;
        }
        if (body.startsAt !== undefined) record.starts_at = body.startsAt;
        if (body.endsAt !== undefined) record.ends_at = body.endsAt;
        if (request.method === "POST" && !body.id) {
          Object.assign(record, { created_by: auth.user.id });
          const { data, error } = await auth.client.from("giving_campaigns").insert(record).select().single();
          if (error) throw new ApiError("CAMPAIGN_CREATE_FAILED", "Unable to create giving campaign", 500, undefined, false);
          return { data, status: 201 };
        }
        const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
        const { data, error } = await auth.client
          .from("giving_campaigns")
          .update(record)
          .eq("id", id)
          .eq("organization_id", organizationId)
          .select()
          .single();
        if (error) throw new ApiError("CAMPAIGN_UPDATE_FAILED", "Unable to update giving campaign", 500, undefined, false);
        return { data };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported expression giving action", 422);
    },
  ),
);
