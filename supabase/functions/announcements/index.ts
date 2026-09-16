import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const channels = new Set(["in_app", "email", "sms", "push"]);
const statuses = new Set(["draft", "scheduled", "published", "cancelled", "archived"]);
const BANNER_BUCKET = "announcement-banners";

function timestamp(value: unknown, field: string) {
  const text = requiredString(value, field, 40);
  if (Number.isNaN(Date.parse(text))) throw new ApiError("VALIDATION_FAILED", `${field} must be an ISO timestamp`, 422);
  return text;
}

function assertFutureSchedule(value: string | null | undefined) {
  if (!value) throw new ApiError("VALIDATION_FAILED", "Choose when this announcement should be published", 422);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time <= Date.now()) throw new ApiError("VALIDATION_FAILED", "Choose a future time for the scheduled announcement", 422);
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const requestedBranchId = url.searchParams.get("branchId");
      const memberFeed = url.searchParams.get("view") === "feed";

      // Cron remains the primary scheduler. This reconciliation makes scheduled
      // delivery resilient if a cron run is delayed: the next announcement read
      // publishes any due records before the list is returned.
      const admin = adminClient();
      await admin.rpc("publish_due_announcements", { reference_time: new Date().toISOString() });

      let query = auth.client
        .from("announcements")
        .select("id,organization_id,branch_id,title,body,status,audience,channels,scheduled_for,published_at,banner_url,created_at,updated_at")
        .eq("organization_id", auth.organizationId);

      if (requestedBranchId) {
        const branchId = uuid(requestedBranchId, "branchId", true)!;
        if (!auth.branchId || auth.branchId !== branchId) throw new ApiError("EXPRESSION_CONTEXT_MISMATCH", "Enter this exact Expression before reading its announcements", 403);
        query = query.eq("branch_id", branchId);
      } else if (!auth.branchId) {
        query = query.is("branch_id", null);
      }
      if (memberFeed) query = query.eq("status","published");
      const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
      if (error) throw new ApiError("ANNOUNCEMENT_LIST_FAILED", "Unable to retrieve announcements", 500, undefined, false);
      return { data: data ?? [] };
    }

    const body = assertObject(await jsonBody(request));

    if (request.method === "POST" && body.action === "create_banner_upload") {
      assertNoUnknownFields(body, ["action", "mimeType"]);
      await authorize(auth, "announcements.manage");
      const mimeType = requiredString(body.mimeType, "mimeType", 80).toLowerCase();
      const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/jpeg" ? "jpg" : null;
      if (!extension) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Choose a JPG, PNG, or WebP banner", 415);
      const path = `orgs/${auth.organizationId}/${auth.user.id}/${crypto.randomUUID()}.${extension}`;
      const admin = adminClient();
      const { data, error } = await admin.storage.from(BANNER_BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (error || !data?.signedUrl) throw new ApiError("UPLOAD_SESSION_FAILED", "Unable to prepare announcement banner upload", 500, undefined, false);
      return { data: { signedUploadUrl: data.signedUrl, publicUrl: admin.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl } };
    }

    if (body.action === "publish") {
      assertNoUnknownFields(body, ["action", "id"]);
      const { data, error } = await auth.client.rpc("publish_announcement", {
        target_announcement_id: uuid(requiredString(body.id, "id", 36), "id", true),
      }).single();
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "Permission denied", 403);
      if (error) throw new ApiError("ANNOUNCEMENT_PUBLISH_FAILED", "Unable to publish announcement", 500, undefined, false);
      return { data };
    }

    await authorize(auth, "announcements.manage");
    assertNoUnknownFields(body, ["id", "branchId", "title", "body", "audience", "channels", "scheduledFor", "status", "bannerUrl"]);
    const record: Record<string, unknown> = {};
    if (request.method === "POST" || body.title !== undefined) record.title = requiredString(body.title, "title", 180);
    if (request.method === "POST" || body.body !== undefined) record.body = requiredString(body.body, "body", 20000);
    if (body.branchId !== undefined) record.branch_id = body.branchId === null ? null : uuid(String(body.branchId), "branchId", true);
    if (request.method === "POST" && body.branchId === undefined) record.branch_id = auth.branchId ?? null;
    if (body.audience !== undefined) {
      if (!body.audience || typeof body.audience !== "object" || Array.isArray(body.audience)) throw new ApiError("VALIDATION_FAILED", "audience must be an object", 422);
      record.audience = body.audience;
    }
    if (body.channels !== undefined) {
      if (!Array.isArray(body.channels) || body.channels.some((channel) => typeof channel !== "string" || !channels.has(channel))) throw new ApiError("VALIDATION_FAILED", "Invalid channels", 422);
      record.channels = body.channels;
    }
    if (body.scheduledFor !== undefined) record.scheduled_for = body.scheduledFor ? timestamp(body.scheduledFor, "scheduledFor") : null;
    if (body.status !== undefined) {
      const status = optionalString(body.status, "status", 20) ?? "draft";
      if (!statuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid announcement status", 422);
      if (status === "scheduled") {
        const scheduleValue = body.scheduledFor !== undefined ? (record.scheduled_for as string | null) : null;
        assertFutureSchedule(scheduleValue);
      }
      record.status = status;
      if (status !== "scheduled" && body.scheduledFor === undefined) record.scheduled_for = null;
    }
    if (body.bannerUrl !== undefined) record.banner_url = optionalString(body.bannerUrl, "bannerUrl", 2000);

    if (request.method === "POST") {
      if (record.status === "scheduled") assertFutureSchedule(record.scheduled_for as string | null | undefined);
      Object.assign(record, { organization_id: auth.organizationId, created_by: auth.user.id });
      const { data, error } = await auth.client.from("announcements").insert(record).select().single();
      if (error) throw new ApiError("ANNOUNCEMENT_CREATE_FAILED", "Unable to create announcement", 500, undefined, false);
      return { data, status: 201 };
    }

    const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
    let update = auth.client.from("announcements").update(record).eq("id", id).eq("organization_id", auth.organizationId);
    if (auth.branchId) update = update.eq("branch_id", auth.branchId);
    else update = update.is("branch_id", null);
    const { data, error } = await update.select().single();
    if (error?.code === "PGRST116") throw new ApiError("ANNOUNCEMENT_NOT_FOUND", "This announcement is not available in the active context", 404);
    if (error) throw new ApiError("ANNOUNCEMENT_UPDATE_FAILED", "Unable to update announcement", 500, undefined, false);
    return { data };
  },
));
