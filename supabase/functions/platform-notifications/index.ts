import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

function optionalString(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}`, 422);
  }
  return value.trim();
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const text = requiredString(value, field, 64);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new ApiError("VALIDATION_FAILED", `Invalid ${field}`, 422);
  return parsed.toISOString();
}

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "none" },
  async ({ request, requestId, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    await authorizePlatform(auth, "platform.notifications.broadcast");
    const admin = adminClient();

    if (request.method === "GET") {
      const url = new URL(request.url);
      const organizationParam = url.searchParams.get("organizationId");
      const organizationId = organizationParam ? uuid(organizationParam, "organizationId", true)! : null;

      const [organizationsResult, branchesResult, broadcastsResult] = await Promise.all([
        admin.from("organizations")
          .select("id,name,slug,status")
          .eq("status", "active")
          .order("name")
          .limit(200),
        organizationId
          ? admin.from("branches")
              .select("id,organization_id,name,code,is_active")
              .eq("organization_id", organizationId)
              .eq("is_active", true)
              .order("name")
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
        admin.from("platform_notification_broadcasts")
          .select("id,organization_id,branch_id,title,body,route,is_urgent,expires_at,created_by,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (organizationsResult.error || branchesResult.error || broadcastsResult.error) {
        throw new ApiError("PLATFORM_NOTIFICATIONS_LOAD_FAILED", "Unable to load notification broadcast controls", 500, undefined, false);
      }

      return {
        data: {
          organizations: organizationsResult.data ?? [],
          branches: branchesResult.data ?? [],
          broadcasts: broadcastsResult.data ?? [],
        },
      };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, [
      "organizationId",
      "branchId",
      "title",
      "body",
      "route",
      "urgent",
      "expiresAt",
    ]);

    const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
    const branchId = body.branchId ? uuid(String(body.branchId), "branchId", true)! : null;
    const title = requiredString(body.title, "title", 160).trim();
    const message = requiredString(body.body, "body", 1200).trim();
    const route = optionalString(body.route, "route", 500);
    const urgent = body.urgent === true;
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");

    if (route && (!route.startsWith("/") || route.startsWith("//"))) {
      throw new ApiError("VALIDATION_FAILED", "Destination must be an in-app COT route", 422);
    }

    const { data, error } = await admin.rpc("create_platform_notification_broadcast", {
      target_organization_id: organizationId,
      target_branch_id: branchId,
      notice_title: title,
      notice_body: message,
      target_route: route,
      urgent_notice: urgent,
      target_expires_at: expiresAt,
      actor_profile_id: auth.user.id,
    });
    if (error) {
      throw new ApiError("PLATFORM_BROADCAST_FAILED", "Unable to publish this notification broadcast", 500, undefined, false);
    }

    const broadcastId = data?.broadcastId ?? null;
    const { error: auditError } = await admin.from("platform_audit_log").insert({
      actor_profile_id: auth.user.id,
      action: urgent ? "notification.broadcast_urgent" : "notification.broadcast",
      target_type: "platform_notification_broadcast",
      target_id: broadcastId,
      request_id: requestId,
      metadata: {
        organizationId,
        branchId,
        route,
        urgent,
        recipientCount: data?.recipientCount ?? 0,
      },
    });
    if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Notification sent but the governance audit could not be recorded", 500, undefined, false);

    return { data, status: 201 };
  },
));
