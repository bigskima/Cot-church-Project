import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler({ methods: ["GET", "POST"], authentication: "required", organization: "required" }, async ({ request, auth }) => {
  if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
  if (request.method === "GET") { await authorize(auth, "attendance.read"); const eventId = uuid(new URL(request.url).searchParams.get("eventId"), "eventId", true)!; const { data, error } = await auth.client.from("attendance_records").select("id, event_id, occurrence_id, membership_id, checked_in_at, checked_in_by, notes").eq("organization_id", auth.organizationId).eq("event_id", eventId).order("checked_in_at"); if (error) throw new ApiError("ATTENDANCE_LIST_FAILED", "Unable to list attendance", 500, undefined, false); return { data: data ?? [] }; }
  const body = assertObject(await jsonBody(request)); assertNoUnknownFields(body, ["eventId", "occurrenceId", "membershipId", "notes"]);
  const { data, error } = await auth.client.rpc("check_in_member", { target_event_id: uuid(requiredString(body.eventId, "eventId", 36), "eventId", true), target_occurrence_id: body.occurrenceId ? uuid(String(body.occurrenceId), "occurrenceId", true) : null, target_membership_id: uuid(requiredString(body.membershipId, "membershipId", 36), "membershipId", true), check_in_notes: optionalString(body.notes, "notes", 500) ?? "" }).single();
  if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You do not have permission to manage attendance", 403); if (error) throw new ApiError("CHECK_IN_FAILED", "Unable to check member in", 500, undefined, false); return { data, status: 201 };
}));
