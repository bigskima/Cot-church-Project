import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

type NotificationScope = "general" | "expression";

function integerParam(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError("VALIDATION_FAILED", "Invalid notification pagination", 422);
  }
  return parsed;
}

function scopeParam(value: unknown): NotificationScope | null {
  if (value === undefined || value === null || value === "") return null;
  if (value !== "general" && value !== "expression") {
    throw new ApiError("VALIDATION_FAILED", "Invalid notification scope", 422);
  }
  return value;
}

function applyScope(query: any, scope: NotificationScope | null, branchId: string | null) {
  if (branchId) return query.eq("data->>branchId", branchId);
  if (scope === "general") return query.is("data->>branchId", null);
  if (scope === "expression") return query.not("data->>branchId", "is", null);
  return query;
}

Deno.serve(createHandler(
  { methods: ["GET", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) {
      throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const paged = url.searchParams.get("paged") === "true";

      if (!paged) {
        let query = auth.client
          .from("notifications")
          .select("id,type,title,body,data,read_at,created_at")
          .eq("organization_id", auth.organizationId)
          .eq("recipient_profile_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (url.searchParams.get("unread") === "true") query = query.is("read_at", null);
        const { data, error } = await query;
        if (error) throw new ApiError("NOTIFICATION_LIST_FAILED", "Unable to retrieve notifications", 500, undefined, false);
        return { data: data ?? [] };
      }

      const limit = integerParam(url.searchParams.get("limit"), 20, 1, 50);
      const offset = integerParam(url.searchParams.get("offset"), 0, 0, 100000);
      const scope = scopeParam(url.searchParams.get("scope"));
      const branchId = uuid(url.searchParams.get("branchId"), "branchId");
      if (branchId && scope === "general") {
        throw new ApiError("VALIDATION_FAILED", "An Expression cannot be requested with General notification scope", 422);
      }

      let listQuery = auth.client
        .from("notifications")
        .select("id,type,title,body,data,read_at,created_at", { count: "exact" })
        .eq("organization_id", auth.organizationId)
        .eq("recipient_profile_id", auth.user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      listQuery = applyScope(listQuery, scope, branchId);
      if (url.searchParams.get("unread") === "true") listQuery = listQuery.is("read_at", null);

      const unreadCount = async (targetScope: NotificationScope | null, targetBranchId: string | null = null) => {
        let query = auth.client
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", auth.organizationId)
          .eq("recipient_profile_id", auth.user.id)
          .is("read_at", null);
        query = applyScope(query, targetScope, targetBranchId);
        const { count, error } = await query;
        if (error) throw new ApiError("NOTIFICATION_COUNT_FAILED", "Unable to count notifications", 500, undefined, false);
        return count ?? 0;
      };

      const [
        listResult,
        activeUnread,
        generalUnread,
        expressionUnread,
      ] = await Promise.all([
        listQuery,
        unreadCount(scope, branchId),
        branchId ? Promise.resolve(0) : unreadCount("general"),
        branchId ? Promise.resolve(0) : unreadCount("expression"),
      ]);

      if (listResult.error) {
        throw new ApiError("NOTIFICATION_LIST_FAILED", "Unable to retrieve notifications", 500, undefined, false);
      }

      const total = listResult.count ?? 0;
      return {
        data: {
          items: listResult.data ?? [],
          page: {
            offset,
            limit,
            total,
            hasMore: offset + (listResult.data?.length ?? 0) < total,
          },
          unreadCount: activeUnread,
          scopeUnread: {
            general: generalUnread,
            expression: expressionUnread,
          },
        },
      };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["id", "read", "markAll", "scope", "branchId"]);
    if (typeof body.read !== "boolean") {
      throw new ApiError("VALIDATION_FAILED", "read must be boolean", 422);
    }

    if (body.markAll === true) {
      const scope = scopeParam(body.scope);
      const branchId = uuid(typeof body.branchId === "string" ? body.branchId : null, "branchId");
      if (branchId && scope === "general") {
        throw new ApiError("VALIDATION_FAILED", "An Expression cannot be used with General notification scope", 422);
      }

      let update = auth.client
        .from("notifications")
        .update({ read_at: body.read ? new Date().toISOString() : null })
        .eq("organization_id", auth.organizationId)
        .eq("recipient_profile_id", auth.user.id);
      if (body.read) update = update.is("read_at", null);
      update = applyScope(update, scope, branchId);

      const { data, error } = await update.select("id");
      if (error) throw new ApiError("NOTIFICATION_UPDATE_FAILED", "Unable to update notifications", 500, undefined, false);
      return { data: { updated: data?.length ?? 0 } };
    }

    const id = uuid(requiredString(body.id, "id", 36), "id", true);
    const { data, error } = await auth.client
      .from("notifications")
      .update({ read_at: body.read ? new Date().toISOString() : null })
      .eq("organization_id", auth.organizationId)
      .eq("id", id)
      .eq("recipient_profile_id", auth.user.id)
      .select("id,read_at")
      .single();

    if (error) throw new ApiError("NOTIFICATION_UPDATE_FAILED", "Unable to update notification", 500, undefined, false);
    return { data };
  },
));
