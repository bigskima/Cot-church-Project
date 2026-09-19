import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH", "DELETE"], authentication: "required", organization: "none" },
  async ({ auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    throw new ApiError(
      "PLATFORM_PUBLIC_DIRECTORY_RETIRED",
      "Church stories, leaders, titles, and badges are managed through scoped COT ministry tools",
      410,
    );
  },
));
