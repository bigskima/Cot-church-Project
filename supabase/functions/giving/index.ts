import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const campaignStatuses = new Set(["draft", "active", "paused", "completed", "archived"]);
function currency(value: unknown) { const result = requiredString(value, "currency", 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(result)) throw new ApiError("VALIDATION_FAILED", "Invalid currency", 422); return result; }
function amount(value: unknown, field = "amountMinor") { const result = Number(value); if (!Number.isSafeInteger(result) || result < 1 || result > 100000000000) throw new ApiError("VALIDATION_FAILED", `${field} must be a positive safe integer`, 422); return result; }

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    const url = new URL(request.url);
    if (request.method === "GET") {
      const view = url.searchParams.get("view") ?? "campaigns";
      if (!new Set(["campaigns", "donations", "receipts"]).has(view)) throw new ApiError("VALIDATION_FAILED", "Invalid giving view", 422);
      const table = view === "campaigns" ? "giving_campaigns" : view;
      let query = auth.client.from(table).select("*").eq("organization_id", auth.organizationId).order(view === "campaigns" ? "created_at" : view === "donations" ? "created_at" : "issued_at", { ascending: false }).limit(100);
      if (view === "donations") query = query.eq("donor_profile_id", auth.user.id);
      if (view === "receipts") query = query.eq("issued_to_profile_id", auth.user.id);
      const { data, error } = await query;
      if (error) throw new ApiError("GIVING_LIST_FAILED", "Unable to retrieve giving records", 500, undefined, false);
      return { data: data ?? [] };
    }
    const body = assertObject(await jsonBody(request));
    if (body.action === "donate") {
      assertNoUnknownFields(body, ["action", "branchId", "campaignId", "amountMinor", "currency", "provider", "idempotencyKey", "anonymous", "note"]);
      const { data, error } = await auth.client.rpc("create_donation_intent", {
        target_organization_id: auth.organizationId,
        target_branch_id: body.branchId ? uuid(String(body.branchId), "branchId", true) : auth.branchId,
        target_campaign_id: body.campaignId ? uuid(String(body.campaignId), "campaignId", true) : null,
        target_amount_minor: amount(body.amountMinor), target_currency: currency(body.currency),
        target_provider: requiredString(body.provider, "provider", 50), target_idempotency_key: requiredString(body.idempotencyKey, "idempotencyKey", 128),
        make_anonymous: body.anonymous === true, donor_message: optionalString(body.note, "note", 1000) ?? "",
      }).single();
      if (error?.code === "23514") throw new ApiError("IDEMPOTENCY_CONFLICT", "Idempotency key conflict", 409);
      if (error) throw new ApiError("DONATION_INTENT_FAILED", "Unable to create donation intent", 500, undefined, false);
      return { data, status: 201 };
    }
    await authorize(auth, "giving.campaigns.manage");
    assertNoUnknownFields(body, ["id", "name", "description", "branchId", "status", "currency", "goalAmountMinor", "startsAt", "endsAt"]);
    const record: Record<string, unknown> = {};
    if (request.method === "POST" || body.name !== undefined) record.name = requiredString(body.name, "name", 180);
    if (body.description !== undefined) record.description = optionalString(body.description, "description", 10000) ?? "";
    if (body.branchId !== undefined) record.branch_id = body.branchId === null ? null : uuid(String(body.branchId), "branchId", true);
    if (request.method === "POST" || body.currency !== undefined) record.currency = currency(body.currency);
    if (body.goalAmountMinor !== undefined) record.goal_amount_minor = body.goalAmountMinor === null ? null : amount(body.goalAmountMinor, "goalAmountMinor");
    if (body.status !== undefined) { const status = requiredString(body.status, "status", 20); if (!campaignStatuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid campaign status", 422); record.status = status; }
    if (body.startsAt !== undefined) record.starts_at = body.startsAt; if (body.endsAt !== undefined) record.ends_at = body.endsAt;
    if (request.method === "POST") { Object.assign(record, { organization_id: auth.organizationId, created_by: auth.user.id }); const { data, error } = await auth.client.from("giving_campaigns").insert(record).select().single(); if (error) throw new ApiError("CAMPAIGN_CREATE_FAILED", "Unable to create campaign", 500, undefined, false); return { data, status: 201 }; }
    const id = uuid(requiredString(body.id, "id", 36), "id", true)!; const { data, error } = await auth.client.from("giving_campaigns").update(record).eq("id", id).eq("organization_id", auth.organizationId).select().single(); if (error) throw new ApiError("CAMPAIGN_UPDATE_FAILED", "Unable to update campaign", 500, undefined, false); return { data };
  },
));
