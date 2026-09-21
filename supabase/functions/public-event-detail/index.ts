import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { publicClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const eventId = uuid(url.searchParams.get("id"), "eventId", true)!;
    const organizationId = uuid(url.searchParams.get("organizationId"), "organizationId");

    const client = publicClient();

    let query = client
      .from("events")
      .select("id,organization_id,branch_id,title,description,status,visibility,location,timezone,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,banner_url,response_form_id")
      .eq("id", eventId)
      .eq("visibility", "public")
      .eq("status", "published");

    if (organizationId) query = query.eq("organization_id", organizationId);

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new ApiError("PUBLIC_EVENT_FAILED", "Unable to retrieve this event", 500, undefined, false);
    }
    if (!data) {
      throw new ApiError("EVENT_NOT_FOUND", "This event is not available", 404);
    }

    return { data };
  },
));
