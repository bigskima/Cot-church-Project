import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const statuses = new Set(["draft", "published", "cancelled", "completed", "archived"]);
const visibilities = new Set(["members", "public", "private"]);
function timestamp(value: unknown, field: string) { const result = requiredString(value, field, 40); if (Number.isNaN(Date.parse(result))) throw new ApiError("VALIDATION_FAILED", `${field} must be an ISO timestamp`, 422); return result; }

Deno.serve(createHandler({ methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" }, async ({ request, auth }) => {
  if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
  if (request.method === "GET") {
    const url = new URL(request.url); const eventId = uuid(url.searchParams.get("id"), "id");
    let query = auth.client.from("events").select("id, branch_id, title, description, status, visibility, location, timezone, starts_at, ends_at, registration_opens_at, registration_closes_at, capacity, recurrence_rule, created_at, updated_at").eq("organization_id", auth.organizationId).order("starts_at");
    if (eventId) query = query.eq("id", eventId); else query = query.gte("ends_at", url.searchParams.get("from") ?? new Date().toISOString()).limit(100);
    const { data, error } = await query; if (error) throw new ApiError("EVENT_LIST_FAILED", "Unable to retrieve events", 500, undefined, false);
    return { data: eventId ? data?.[0] ?? null : data ?? [] };
  }
  const body = assertObject(await jsonBody(request));
  if (request.method === "POST") {
    await authorize(auth, "events.create");
    assertNoUnknownFields(body, ["branchId", "title", "description", "visibility", "location", "timezone", "startsAt", "endsAt", "registrationOpensAt", "registrationClosesAt", "capacity", "recurrenceRule"]);
    const visibility = optionalString(body.visibility, "visibility", 20) ?? "members"; if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422);
    const capacity = body.capacity == null ? null : Number(body.capacity); if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) throw new ApiError("VALIDATION_FAILED", "capacity must be a positive integer", 422);
    const record = { organization_id: auth.organizationId, branch_id: body.branchId ? uuid(String(body.branchId), "branchId", true) : null, title: requiredString(body.title, "title", 180), description: optionalString(body.description, "description", 10000) ?? "", visibility, location: body.location ?? {}, timezone: optionalString(body.timezone, "timezone", 64) ?? "UTC", starts_at: timestamp(body.startsAt, "startsAt"), ends_at: timestamp(body.endsAt, "endsAt"), registration_opens_at: body.registrationOpensAt ? timestamp(body.registrationOpensAt, "registrationOpensAt") : null, registration_closes_at: body.registrationClosesAt ? timestamp(body.registrationClosesAt, "registrationClosesAt") : null, capacity, recurrence_rule: body.recurrenceRule ?? null, created_by: auth.user.id };
    const { data, error } = await auth.client.from("events").insert(record).select().single(); if (error) throw new ApiError("EVENT_CREATE_FAILED", "Unable to create event", 500, undefined, false); return { data, status: 201 };
  }
  await authorize(auth, "events.update"); assertNoUnknownFields(body, ["id", "title", "description", "status", "visibility", "startsAt", "endsAt", "capacity"]);
  const id = uuid(requiredString(body.id, "id", 36), "id", true)!; const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = requiredString(body.title, "title", 180); if (body.description !== undefined) updates.description = requiredString(body.description, "description", 10000);
  if (body.status !== undefined) { const status = requiredString(body.status, "status", 20); if (!statuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid status", 422); updates.status = status; }
  if (body.visibility !== undefined) { const visibility = requiredString(body.visibility, "visibility", 20); if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422); updates.visibility = visibility; }
  if (body.startsAt !== undefined) updates.starts_at = timestamp(body.startsAt, "startsAt"); if (body.endsAt !== undefined) updates.ends_at = timestamp(body.endsAt, "endsAt");
  if (body.capacity !== undefined) { const capacity = body.capacity === null ? null : Number(body.capacity); if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) throw new ApiError("VALIDATION_FAILED", "Invalid capacity", 422); updates.capacity = capacity; }
  if (!Object.keys(updates).length) throw new ApiError("VALIDATION_FAILED", "At least one field is required", 422);
  const { data, error } = await auth.client.from("events").update(updates).eq("id", id).eq("organization_id", auth.organizationId).select().single(); if (error) throw new ApiError("EVENT_UPDATE_FAILED", "Unable to update event", 500, undefined, false); return { data };
}));
