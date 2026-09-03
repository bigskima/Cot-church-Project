import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString } from "../_shared/validation.ts";

const categories = new Set(["ai", "streaming", "payments", "communications", "integration", "other"]);

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    await authorizePlatform(auth, "platform.secrets.manage");

    if (request.method === "GET") {
      const { data, error } = await auth.client
        .from("platform_secret_metadata")
        .select("secret_reference,category,provider_code,description,created_at,updated_at,rotated_at")
        .order("category", { ascending: true })
        .order("secret_reference", { ascending: true });
      if (error) throw new ApiError("SECRET_METADATA_LIST_FAILED", "Unable to retrieve provider credential metadata", 500, undefined, false);
      return { data: data ?? [] };
    }

    const body = assertObject(await jsonBody(request));
    const action = requiredString(body.action, "action", 30);

    if (action === "store") {
      assertNoUnknownFields(body, ["action", "reference", "value", "category", "providerCode", "description"]);
      const reference = requiredString(body.reference, "reference", 128).trim().toUpperCase();
      const value = requiredString(body.value, "value", 65536);
      const category = requiredString(body.category, "category", 30);
      if (!categories.has(category)) throw new ApiError("VALIDATION_FAILED", "Invalid provider credential category", 422);
      const providerCode = optionalString(body.providerCode, "providerCode", 80)?.trim() || null;
      const description = optionalString(body.description, "description", 500)?.trim() || "";

      const { data, error } = await auth.client.rpc("platform_store_secret", {
        target_reference: reference,
        secret_value: value,
        secret_category: category,
        target_provider_code: providerCode,
        target_description: description,
      });
      if (error?.code === "42501") throw new ApiError("PLATFORM_PERMISSION_DENIED", "You do not have permission to manage provider credentials", 403);
      if (error) throw new ApiError("SECRET_STORE_FAILED", error.message || "Unable to store provider credential", 400);
      return { data: Array.isArray(data) ? data[0] ?? null : data, status: 201 };
    }

    if (action === "delete") {
      assertNoUnknownFields(body, ["action", "reference"]);
      const reference = requiredString(body.reference, "reference", 128).trim().toUpperCase();
      const { data, error } = await auth.client.rpc("platform_delete_secret", { target_reference: reference });
      if (error?.code === "42501") throw new ApiError("PLATFORM_PERMISSION_DENIED", "You do not have permission to remove provider credentials", 403);
      if (error) throw new ApiError("SECRET_DELETE_FAILED", "Unable to remove provider credential", 500, undefined, false);
      return { data: { deleted: data === true } };
    }

    if (action === "check") {
      assertNoUnknownFields(body, ["action", "reference"]);
      const reference = requiredString(body.reference, "reference", 128).trim().toUpperCase();
      const environmentValue = Deno.env.get(reference);
      if (environmentValue) return { data: { reference, configured: true, source: "deployment_environment" } };
      const { data, error } = await adminClient().rpc("resolve_runtime_secret", { target_reference: reference });
      if (error) throw new ApiError("SECRET_CHECK_FAILED", "Unable to check provider credential", 500, undefined, false);
      return { data: { reference, configured: typeof data === "string" && data.length > 0, source: data ? "platform_vault" : null } };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported provider credential action", 422);
  },
));
