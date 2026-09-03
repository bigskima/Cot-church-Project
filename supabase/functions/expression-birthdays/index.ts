import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    if (!auth.branchId) throw new ApiError("EXPRESSION_REQUIRED", "Select or join an Expression to view birthdays", 400);

    const url = new URL(request.url);
    const daysParam = url.searchParams.get("daysAhead");
    const daysAhead = daysParam === null ? 90 : Number(daysParam);
    if (!Number.isInteger(daysAhead) || daysAhead < 0 || daysAhead > 366) {
      throw new ApiError("VALIDATION_FAILED", "daysAhead must be a whole number between 0 and 366", 422);
    }

    const { data, error } = await auth.client.rpc("expression_birthdays", {
      target_organization_id: auth.organizationId,
      target_branch_id: auth.branchId,
      days_ahead: daysAhead,
    });
    if (error?.code === "42501") throw new ApiError("EXPRESSION_ACCESS_DENIED", "Only members of this Expression can view its birthday calendar", 403);
    if (error?.code === "P0002") throw new ApiError("EXPRESSION_NOT_FOUND", "Expression not found", 404);
    if (error?.code === "22023") throw new ApiError("VALIDATION_FAILED", error.message, 422);
    if (error) throw new ApiError("BIRTHDAY_LIST_FAILED", "Unable to retrieve Expression birthdays", 500, undefined, false);

    return { data: data ?? [] };
  },
));
