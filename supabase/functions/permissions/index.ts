import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "required", organization: "required", permission: "roles.read" },
  async ({ auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    const { data, error } = await auth.client.from("permissions").select("code, name, description, category").eq("is_active", true).order("category").order("code");
    if (error) throw new ApiError("PERMISSION_LIST_FAILED", "Unable to list permissions", 500, undefined, false);
    return { data: data ?? [] };
  },
));
