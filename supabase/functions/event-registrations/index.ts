import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler({ methods: ["GET", "POST"], authentication: "required", organization: "required" }, async ({ request, auth }) => {
  if (!auth?.organizationId || !auth.membershipId) throw new ApiError("ORGANIZATION_REQUIRED", "Active organization membership is required", 400);
  if (request.method === "GET") { const { data, error } = await auth.client.from("event_registrations").select("id, event_id, occurrence_id, status, registered_at, event:events(id, title, starts_at, ends_at)").eq("membership_id", auth.membershipId).order("registered_at", { ascending: false }); if (error) throw new ApiError("REGISTRATION_LIST_FAILED", "Unable to list registrations", 500, undefined, false); return { data: data ?? [] }; }
  const body = assertObject(await jsonBody(request)); assertNoUnknownFields(body, ["eventId", "occurrenceId"]);
  const { data, error } = await auth.client.rpc("register_for_event", { target_event_id: uuid(requiredString(body.eventId, "eventId", 36), "eventId", true), target_occurrence_id: body.occurrenceId ? uuid(String(body.occurrenceId), "occurrenceId", true) : null }).single();
  if (error?.code === "P0002") throw new ApiError("EVENT_NOT_FOUND", "Published event was not found", 404); if (error?.code === "22023") throw new ApiError("REGISTRATION_UNAVAILABLE", error.message, 409); if (error) throw new ApiError("REGISTRATION_FAILED", "Unable to register", 500, undefined, false); return { data, status: 201 };
}));
