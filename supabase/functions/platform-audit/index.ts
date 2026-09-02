import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(
  createHandler(
    { methods: ["GET"], authentication: "required", organization: "none" },
    async ({ request, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      await authorizePlatform(auth, "platform.audit.read");
      const url = new URL(request.url);
      const targetType = url.searchParams.get("targetType")?.trim().slice(0, 80) || null;
      const action = url.searchParams.get("action")?.trim().slice(0, 120) || null;
      const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "30") || 30));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const admin = adminClient();
      let query = admin
        .from("platform_audit_log")
        .select("id,actor_profile_id,action,target_type,target_id,request_id,metadata,occurred_at,profiles:actor_profile_id(display_name,avatar_url)", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .range(from, to);
      if (targetType) query = query.eq("target_type", targetType);
      if (action) query = query.eq("action", action);

      const { data, error, count } = await query;
      if (error) throw new ApiError("PLATFORM_AUDIT_FAILED", "Unable to retrieve platform audit records", 500, undefined, false);
      return { data: { items: data ?? [], page, pageSize, total: count ?? 0 } };
    },
  ),
);
