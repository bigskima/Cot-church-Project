import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(
  createHandler(
    { methods: ["GET"], authentication: "required", organization: "none" },
    async () => {
      throw new ApiError(
        "SEARCH_ENDPOINT_RETIRED",
        "This search endpoint is retired. Public discovery search is served by public-content.",
        410,
      );
    },
  ),
);
