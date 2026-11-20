import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH", "DELETE"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.expressions.read");
        const url = new URL(request.url);
        const search = url.searchParams.get("q")?.trim() ?? "";
        const organizationId = url.searchParams.get("organizationId");
        const active = url.searchParams.get("active");
        const deleted = url.searchParams.get("deleted");
        const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "30") || 30));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = admin
          .from("branches")
          .select("id,organization_id,parent_branch_id,name,code,timezone,address,is_active,deleted_at,deleted_by,deletion_reason,created_at,updated_at,organizations(id,name,slug,status)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (organizationId) query = query.eq("organization_id", uuid(organizationId, "organizationId", true)!);
        if (active === "true") query = query.eq("is_active", true);
        if (active === "false") query = query.eq("is_active", false);
        if (active && active !== "true" && active !== "false") throw new ApiError("VALIDATION_FAILED", "Invalid active filter", 422);

        if (deleted === "true") query = query.not("deleted_at", "is", null);
        else if (deleted === "false") query = query.is("deleted_at", null);
        else if (deleted && deleted !== "all") throw new ApiError("VALIDATION_FAILED", "Invalid deleted filter", 422);

        if (search) {
          const safeSearch = search.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
          if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,code.ilike.%${safeSearch}%`);
        }

        const { data, error, count } = await query;
        if (error) throw new ApiError("PLATFORM_EXPRESSIONS_FAILED", "Unable to retrieve platform expressions", 500, undefined, false);
        return { data: { items: data ?? [], page, pageSize, total: count ?? 0 } };
      }

      await authorizePlatform(auth, "platform.expressions.manage");
      const body = assertObject(await jsonBody(request));

      if (request.method === "DELETE") {
        assertNoUnknownFields(body, ["expressionId", "reason", "confirmation"]);
        const expressionId = uuid(requiredString(body.expressionId, "expressionId", 64), "expressionId", true)!;
        const reason = requiredString(body.reason, "reason", 1000);
        const confirmation = requiredString(body.confirmation, "confirmation", 160);

        const { data, error } = await admin.rpc("platform_delete_expression", {
          target_expression_id: expressionId,
          actor_profile_id: auth.user.id,
          deletion_reason: reason,
          confirmation_code: confirmation,
          audit_request_id: requestId,
        });
        if (error) {
          if (error.code === "P0002") throw new ApiError("EXPRESSION_NOT_FOUND", error.message, 404);
          if (error.code === "22023" || error.code === "23514") throw new ApiError("VALIDATION_FAILED", error.message, 422);
          throw new ApiError("EXPRESSION_DELETE_FAILED", "Unable to delete this Expression", 500, undefined, false);
        }
        return { data };
      }

      assertNoUnknownFields(body, ["expressionId", "isActive", "reason"]);
      const expressionId = uuid(requiredString(body.expressionId, "expressionId", 64), "expressionId", true)!;
      if (typeof body.isActive !== "boolean") throw new ApiError("VALIDATION_FAILED", "isActive must be a boolean", 422);
      const reason = optionalString(body.reason, "reason", 1000) ?? null;
      if (body.isActive === false && !reason) throw new ApiError("VALIDATION_FAILED", "A governance reason is required when disabling an expression", 422, { reason: "Required" });

      const { data: current, error: currentError } = await admin
        .from("branches")
        .select("id,organization_id,name,code,is_active,deleted_at,deletion_reason,updated_at")
        .eq("id", expressionId)
        .maybeSingle();
      if (currentError || !current) throw new ApiError("EXPRESSION_NOT_FOUND", "Expression not found", 404);
      if (current.deleted_at) throw new ApiError("EXPRESSION_DELETED", "Deleted Expressions cannot be restored through lifecycle controls", 409);
      if (current.is_active === body.isActive) return { data: current };

      const { data: updated, error: updateError } = await admin
        .from("branches")
        .update({ is_active: body.isActive })
        .eq("id", expressionId)
        .is("deleted_at", null)
        .select("id,organization_id,name,code,is_active,deleted_at,deletion_reason,updated_at")
        .single();
      if (updateError) throw new ApiError("PLATFORM_EXPRESSION_UPDATE_FAILED", "Unable to update expression lifecycle", 500, undefined, false);

      const { error: auditError } = await admin.from("platform_audit_log").insert({
        actor_profile_id: auth.user.id,
        action: body.isActive ? "expression.restored" : "expression.disabled",
        target_type: "expression",
        target_id: expressionId,
        request_id: requestId,
        metadata: {
          organizationId: current.organization_id,
          previousActive: current.is_active,
          newActive: body.isActive,
          reason,
        },
      });
      if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Expression changed but the governance audit could not be recorded", 500, undefined, false);

      return { data: updated };
    },
  ),
);
