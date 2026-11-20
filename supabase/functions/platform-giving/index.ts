import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async () => {
      throw new ApiError(
        "PLATFORM_GIVING_RETIRED",
        "Platform Administration does not own church giving. Manage church-wide and Expression giving through church-scoped leadership permissions.",
        410,
      );
    },
  ),
);
