import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "none", organization: "none" },
  () => ({
    data: {
      service: "church-platform-api",
      status: "healthy",
      version: "v1",
      timestamp: new Date().toISOString(),
    },
  }),
));
