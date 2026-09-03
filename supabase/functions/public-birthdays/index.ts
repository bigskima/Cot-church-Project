import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { publicClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = uuid(url.searchParams.get("organizationId"), "organizationId", true)!;
    const rawDays = url.searchParams.get("daysAhead") ?? "60";
    const daysAhead = Number(rawDays);
    if (!Number.isInteger(daysAhead) || daysAhead < 0 || daysAhead > 366) {
      throw new ApiError("VALIDATION_FAILED", "daysAhead must be an integer between 0 and 366", 422);
    }

    const { data, error } = await publicClient().rpc("public_birthdays", {
      target_organization_id: organizationId,
      days_ahead: daysAhead,
    });

    if (error?.code === "P0002") throw new ApiError("ORGANIZATION_NOT_FOUND", "Church organization not found", 404);
    if (error?.code === "22023") throw new ApiError("VALIDATION_FAILED", error.message, 422);
    if (error) throw new ApiError("PUBLIC_BIRTHDAYS_FAILED", "Unable to retrieve public birthdays", 500, undefined, false);
    return { data: data ?? [] };
  },
));
