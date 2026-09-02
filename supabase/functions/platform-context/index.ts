import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(
  createHandler(
    { methods: ["GET"], authentication: "required", organization: "none" },
    async ({ auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      await authorizePlatform(auth, "platform.overview.read");

      const admin = adminClient();
      const now = new Date().toISOString();
      const { data: assignments, error: assignmentError } = await admin
        .from("platform_role_assignments")
        .select("id,role_code,expires_at,created_at,platform_roles(code,name,description)")
        .eq("profile_id", auth.user.id)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: true });
      if (assignmentError) throw assignmentError;

      const roleCodes = [...new Set((assignments ?? []).map((row) => row.role_code))];
      let permissions: string[] = [];
      if (roleCodes.length > 0) {
        const { data: grants, error: grantError } = await admin
          .from("platform_role_permissions")
          .select("permission_code")
          .in("role_code", roleCodes);
        if (grantError) throw grantError;
        permissions = [...new Set((grants ?? []).map((row) => row.permission_code))].sort();
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("id,display_name,avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();

      return {
        data: {
          profile: profile ?? { id: auth.user.id, display_name: auth.user.email ?? "Platform Authority", avatar_url: null },
          email: auth.user.email ?? null,
          roles: assignments ?? [],
          effectivePermissions: permissions,
        },
      };
    },
  ),
);
