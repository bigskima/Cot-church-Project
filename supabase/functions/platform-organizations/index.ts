import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const allowedStatuses = new Set(["active", "suspended", "archived"]);

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.organizations.read");
        const url = new URL(request.url);
        const search = url.searchParams.get("q")?.trim() ?? "";
        const status = url.searchParams.get("status")?.trim() ?? "";
        const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "30") || 30));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        if (status && !allowedStatuses.has(status)) {
          throw new ApiError("VALIDATION_FAILED", "Invalid organization status filter", 422);
        }

        let query = admin
          .from("organizations")
          .select("id,name,slug,status,timezone,created_at,updated_at,branches(count),memberships(count)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);
        if (status) query = query.eq("status", status);
        if (search) {
          const safeSearch = search.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
          if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`);
        }

        const { data, error, count } = await query;
        if (error) throw new ApiError("PLATFORM_ORGANIZATIONS_FAILED", "Unable to retrieve platform organizations", 500, undefined, false);

        return {
          data: {
            items: data ?? [],
            page,
            pageSize,
            total: count ?? 0,
          },
        };
      }

      await authorizePlatform(auth, "platform.organizations.manage");
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["organizationId", "status", "reason"]);
      const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
      const status = requiredString(body.status, "status", 32);
      const reason = optionalString(body.reason, "reason", 1000) ?? null;
      if (!allowedStatuses.has(status)) {
        throw new ApiError("VALIDATION_FAILED", "Invalid organization status", 422);
      }
      if (status !== "active" && !reason) {
        throw new ApiError("VALIDATION_FAILED", "A governance reason is required when restricting an organization", 422, { reason: "Required" });
      }

      const { data: current, error: currentError } = await admin
        .from("organizations")
        .select("id,name,slug,status,timezone,created_at,updated_at")
        .eq("id", organizationId)
        .maybeSingle();
      if (currentError || !current) throw new ApiError("ORGANIZATION_NOT_FOUND", "Organization not found", 404);

      if (current.status === status) return { data: current };

      const { data: updated, error: updateError } = await admin
        .from("organizations")
        .update({ status })
        .eq("id", organizationId)
        .select("id,name,slug,status,timezone,created_at,updated_at")
        .single();
      if (updateError) throw new ApiError("PLATFORM_ORGANIZATION_UPDATE_FAILED", "Unable to update organization lifecycle", 500, undefined, false);

      const { error: auditError } = await admin.from("platform_audit_log").insert({
        actor_profile_id: auth.user.id,
        action: `organization.${status}`,
        target_type: "organization",
        target_id: organizationId,
        request_id: requestId,
        metadata: { previousStatus: current.status, newStatus: status, reason },
      });
      if (auditError) {
        throw new ApiError("PLATFORM_AUDIT_FAILED", "Organization changed but the governance audit could not be recorded", 500, undefined, false);
      }

      return { data: updated };
    },
  ),
);
