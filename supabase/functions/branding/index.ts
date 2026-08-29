import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString } from "../_shared/validation.ts";
import { publicClient } from "../_shared/supabase.ts";

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "optional", organization: "optional" },
    async ({ request, auth }) => {
      if (request.method === "GET") {
        const client = auth?.client ?? publicClient();
        const { data, error } = await client
          .from("platform_branding")
          .select("id, platform_name, primary_logo_url, compact_logo_url, dark_logo_url, public_header_logo_url, launch_logo_url, launch_background_url, default_placeholder_logo_url, default_leader_placeholder_url, theme_tokens, is_active, updated_at")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          throw new ApiError("BRANDING_FETCH_FAILED", "Unable to retrieve platform branding", 500, undefined, false);
        }

        const fallbackBranding = {
          platform_name: "Church Digital Platform",
          primary_logo_url: null,
          compact_logo_url: null,
          dark_logo_url: null,
          public_header_logo_url: null,
          launch_logo_url: null,
          launch_background_url: null,
          default_placeholder_logo_url: null,
          default_leader_placeholder_url: null,
          theme_tokens: {
            primary: "#091733",
            accent: "#E5B94B",
            cream: "#F4F2EB",
          },
        };

        return { data: data ?? fallbackBranding };
      }

      // PATCH
      if (!auth?.user) {
        throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
      }
      await authorize(auth, "platform.branding.manage");

      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, [
        "platformName",
        "primaryLogoUrl",
        "compactLogoUrl",
        "darkLogoUrl",
        "publicHeaderLogoUrl",
        "launchLogoUrl",
        "launchBackgroundUrl",
        "defaultPlaceholderLogoUrl",
        "defaultLeaderPlaceholderUrl",
        "themeTokens",
      ]);

      const updates: Record<string, unknown> = {
        updated_by: auth.user.id,
      };

      if (body.platformName !== undefined) updates.platform_name = requiredString(body.platformName, "platformName", 120);
      if (body.primaryLogoUrl !== undefined) updates.primary_logo_url = optionalString(body.primaryLogoUrl, "primaryLogoUrl", 2000);
      if (body.compactLogoUrl !== undefined) updates.compact_logo_url = optionalString(body.compactLogoUrl, "compactLogoUrl", 2000);
      if (body.darkLogoUrl !== undefined) updates.dark_logo_url = optionalString(body.darkLogoUrl, "darkLogoUrl", 2000);
      if (body.publicHeaderLogoUrl !== undefined) updates.public_header_logo_url = optionalString(body.publicHeaderLogoUrl, "publicHeaderLogoUrl", 2000);
      if (body.launchLogoUrl !== undefined) updates.launch_logo_url = optionalString(body.launchLogoUrl, "launchLogoUrl", 2000);
      if (body.launchBackgroundUrl !== undefined) updates.launch_background_url = optionalString(body.launchBackgroundUrl, "launchBackgroundUrl", 2000);
      if (body.defaultPlaceholderLogoUrl !== undefined) updates.default_placeholder_logo_url = optionalString(body.defaultPlaceholderLogoUrl, "defaultPlaceholderLogoUrl", 2000);
      if (body.defaultLeaderPlaceholderUrl !== undefined) updates.default_leader_placeholder_url = optionalString(body.defaultLeaderPlaceholderUrl, "defaultLeaderPlaceholderUrl", 2000);
      if (body.themeTokens !== undefined && typeof body.themeTokens === "object") updates.theme_tokens = body.themeTokens;

      const { data: existing } = await auth.client.from("platform_branding").select("id").limit(1).single();

      let result;
      if (existing?.id) {
        const { data, error } = await auth.client
          .from("platform_branding")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw new ApiError("BRANDING_UPDATE_FAILED", "Unable to update platform branding", 500, undefined, false);
        result = data;
      } else {
        const { data, error } = await auth.client
          .from("platform_branding")
          .insert({ ...updates, is_active: true })
          .select()
          .single();
        if (error) throw new ApiError("BRANDING_CREATE_FAILED", "Unable to create platform branding", 500, undefined, false);
        result = data;
      }

      return { data: result };
    }
  )
);
