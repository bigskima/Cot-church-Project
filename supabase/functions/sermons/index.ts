import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const statuses = new Set(["draft", "review", "scheduled", "published", "archived"]);
const visibilities = new Set(["public", "organization", "branch", "private"]);

async function hasScopedPermission(auth: any, permission: string, branchId: string | null) {
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: auth.organizationId,
    requested_permission: permission,
    target_branch_id: branchId,
  });
  return !error && data === true;
}

async function assertScopedPermission(auth: any, permission: string, branchId: string | null, message: string) {
  if (!(await hasScopedPermission(auth, permission, branchId))) {
    throw new ApiError("PERMISSION_DENIED", message, 403);
  }
}

async function validateSeries(auth: any, seriesId: string | null, targetExpressionId: string | null) {
  if (!seriesId) return null;
  const { data, error } = await auth.client
    .from("sermon_series")
    .select("id,organization_id,expression_id")
    .eq("id", seriesId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();
  if (error || !data) throw new ApiError("SERMON_SERIES_NOT_FOUND", "Sermon series is unavailable", 404);
  if (data.expression_id && data.expression_id !== targetExpressionId) {
    throw new ApiError("EXPRESSION_SCOPE_DENIED", "The selected sermon series belongs to another Expression", 403);
  }
  return data;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const organizationId = auth?.organizationId ?? uuid(url.searchParams.get("organizationId"), "organizationId");

    if (request.method === "GET") {
      if (!organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
      const sermonId = uuid(url.searchParams.get("id"), "id");
      const seriesId = uuid(url.searchParams.get("seriesId"), "seriesId");
      const queryTerm = url.searchParams.get("q")?.trim();
      const client = auth?.client ?? (await import("../_shared/supabase.ts")).publicClient();

      if (url.searchParams.get("type") === "series") {
        let seriesQuery = client
          .from("sermon_series")
          .select("id,organization_id,expression_id,title,slug,description,artwork_url,starts_at,ends_at,is_featured,visibility")
          .eq("organization_id", organizationId)
          .order("starts_at", { ascending: false })
          .limit(50);
        if (auth?.branchId) seriesQuery = seriesQuery.or(`expression_id.is.null,expression_id.eq.${auth.branchId}`);
        const { data, error } = await seriesQuery;
        if (error) throw new ApiError("SERIES_LIST_FAILED", "Unable to retrieve sermon series", 500, undefined, false);
        return { data: data ?? [] };
      }

      let query = client
        .from("sermons")
        .select("id,organization_id,expression_id,series_id,recording_id,title,slug,preacher,sermon_date,scripture_references,topics,description,transcript,audio_url,video_url,thumbnail_url,duration_seconds,status,visibility,is_featured,play_count,published_at")
        .eq("organization_id", organizationId);

      if (sermonId) {
        query = query.eq("id", sermonId);
      } else {
        if (!auth?.user) query = query.eq("status", "published").eq("visibility", "public");
        if (seriesId) query = query.eq("series_id", seriesId);
        if (queryTerm) query = query.ilike("title", `%${queryTerm.replace(/[%_]/g, "\\$&")}%`);
        query = query.order("sermon_date", { ascending: false }).limit(100);
      }

      const { data, error } = await query;
      if (error) throw new ApiError("SERMONS_LIST_FAILED", "Unable to retrieve sermons", 500, undefined, false);
      return { data: sermonId ? data?.[0] ?? null : data ?? [] };
    }

    if (!auth?.user || !auth.organizationId) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
    }

    const body = assertObject(await jsonBody(request));

    if (request.method === "POST" && body.action === "convert_recording") {
      assertNoUnknownFields(body, ["action", "recordingId", "title", "preacher", "description", "seriesId"]);
      const recordingId = uuid(requiredString(body.recordingId, "recordingId", 36), "recordingId", true)!;
      const title = requiredString(body.title, "title", 200);
      const preacher = requiredString(body.preacher, "preacher", 120);
      const description = optionalString(body.description, "description", 10000) ?? "";
      const seriesId = body.seriesId ? uuid(String(body.seriesId), "seriesId", true) : null;
      const { data, error } = await auth.client.rpc("convert_recording_to_sermon", {
        target_recording_id: recordingId,
        sermon_title: title,
        preacher_name: preacher,
        sermon_description: description,
        target_series_id: seriesId,
      });
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", error.message || "You cannot convert this recording", 403);
      if (error) throw new ApiError("CONVERT_FAILED", error.message ?? "Unable to convert recording to sermon", 400);
      return { data, status: 201 };
    }

    if (request.method === "POST") {
      assertNoUnknownFields(body, ["title", "preacher", "sermonDate", "expressionId", "seriesId", "description", "transcript", "audioUrl", "videoUrl", "thumbnailUrl", "durationSeconds", "scriptures", "topics", "status", "visibility"]);

      const suppliedExpressionId = body.expressionId ? uuid(String(body.expressionId), "expressionId", true)! : null;
      if (auth.branchId && suppliedExpressionId && suppliedExpressionId !== auth.branchId) {
        throw new ApiError("EXPRESSION_SCOPE_DENIED", "A sermon can only be created inside the selected Expression", 403);
      }
      const targetExpressionId = auth.branchId ?? suppliedExpressionId;
      await assertScopedPermission(auth, "sermons.create", targetExpressionId, "You cannot create sermons in this scope");

      const title = requiredString(body.title, "title", 200).trim();
      const preacher = requiredString(body.preacher, "preacher", 120).trim();
      const status = optionalString(body.status, "status", 20) ?? "draft";
      const visibility = optionalString(body.visibility, "visibility", 20) ?? (targetExpressionId ? "branch" : "public");
      if (!statuses.has(status) || !visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid status or visibility", 422);
      if (visibility === "branch" && !targetExpressionId) throw new ApiError("VALIDATION_FAILED", "Expression visibility requires an Expression", 422);
      if (["scheduled", "published"].includes(status)) {
        await assertScopedPermission(auth, "sermons.publish", targetExpressionId, "Publishing sermons requires publish permission in this scope");
      }

      const seriesId = body.seriesId ? uuid(String(body.seriesId), "seriesId", true)! : null;
      await validateSeries(auth, seriesId, targetExpressionId);
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;
      const duration = body.durationSeconds == null ? null : Number(body.durationSeconds);
      if (duration != null && (!Number.isFinite(duration) || duration < 0)) throw new ApiError("VALIDATION_FAILED", "durationSeconds must be zero or greater", 422);

      const record = {
        organization_id: auth.organizationId,
        expression_id: targetExpressionId,
        series_id: seriesId,
        title,
        slug,
        preacher,
        sermon_date: optionalString(body.sermonDate, "sermonDate", 20) ?? new Date().toISOString().slice(0, 10),
        description: optionalString(body.description, "description", 10000)?.trim() ?? "",
        transcript: optionalString(body.transcript, "transcript", 500000),
        audio_url: optionalString(body.audioUrl, "audioUrl", 2000),
        video_url: optionalString(body.videoUrl, "videoUrl", 2000),
        thumbnail_url: optionalString(body.thumbnailUrl, "thumbnailUrl", 2000),
        duration_seconds: duration,
        scripture_references: Array.isArray(body.scriptures) ? body.scriptures.map(String).slice(0, 100) : [],
        topics: Array.isArray(body.topics) ? body.topics.map(String).slice(0, 100) : [],
        status,
        visibility,
        created_by: auth.user.id,
        published_at: status === "published" ? new Date().toISOString() : null,
      };

      const { data, error } = await auth.client.from("sermons").insert(record).select().single();
      if (error) throw new ApiError("SERMON_CREATE_FAILED", "Unable to create sermon", 500, undefined, false);
      return { data, status: 201 };
    }

    assertNoUnknownFields(body, ["id", "title", "preacher", "sermonDate", "description", "transcript", "audioUrl", "videoUrl", "thumbnailUrl", "durationSeconds", "scriptures", "topics", "status", "visibility", "isFeatured"]);
    const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
    const { data: existing, error: existingError } = await auth.client
      .from("sermons")
      .select("id,expression_id,status")
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (existingError || !existing) throw new ApiError("SERMON_NOT_FOUND", "Sermon is unavailable", 404);
    if (auth.branchId && existing.expression_id !== auth.branchId) throw new ApiError("EXPRESSION_SCOPE_DENIED", "This sermon belongs to another Expression", 403);
    await assertScopedPermission(auth, "sermons.manage", existing.expression_id, "You cannot manage this sermon");

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = requiredString(body.title, "title", 200).trim();
    if (body.preacher !== undefined) updates.preacher = requiredString(body.preacher, "preacher", 120).trim();
    if (body.sermonDate !== undefined) updates.sermon_date = requiredString(body.sermonDate, "sermonDate", 20);
    if (body.description !== undefined) updates.description = optionalString(body.description, "description", 10000)?.trim() ?? "";
    if (body.transcript !== undefined) updates.transcript = optionalString(body.transcript, "transcript", 500000);
    if (body.audioUrl !== undefined) updates.audio_url = optionalString(body.audioUrl, "audioUrl", 2000);
    if (body.videoUrl !== undefined) updates.video_url = optionalString(body.videoUrl, "videoUrl", 2000);
    if (body.thumbnailUrl !== undefined) updates.thumbnail_url = optionalString(body.thumbnailUrl, "thumbnailUrl", 2000);
    if (body.durationSeconds !== undefined) {
      const duration = body.durationSeconds == null ? null : Number(body.durationSeconds);
      if (duration != null && (!Number.isFinite(duration) || duration < 0)) throw new ApiError("VALIDATION_FAILED", "durationSeconds must be zero or greater", 422);
      updates.duration_seconds = duration;
    }
    if (body.scriptures !== undefined) {
      if (!Array.isArray(body.scriptures)) throw new ApiError("VALIDATION_FAILED", "scriptures must be an array", 422);
      updates.scripture_references = body.scriptures.map(String).slice(0, 100);
    }
    if (body.topics !== undefined) {
      if (!Array.isArray(body.topics)) throw new ApiError("VALIDATION_FAILED", "topics must be an array", 422);
      updates.topics = body.topics.map(String).slice(0, 100);
    }
    if (body.isFeatured !== undefined) updates.is_featured = Boolean(body.isFeatured);

    if (body.status !== undefined) {
      const status = requiredString(body.status, "status", 20);
      if (!statuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid status", 422);
      if (["scheduled", "published"].includes(status)) {
        await assertScopedPermission(auth, "sermons.publish", existing.expression_id, "Publishing sermons requires publish permission in this scope");
      }
      updates.status = status;
      if (status === "published") updates.published_at = new Date().toISOString();
    }

    if (body.visibility !== undefined) {
      const visibility = requiredString(body.visibility, "visibility", 20);
      if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422);
      if (visibility === "branch" && !existing.expression_id) throw new ApiError("VALIDATION_FAILED", "Expression visibility requires an Expression sermon", 422);
      updates.visibility = visibility;
    }
    if (!Object.keys(updates).length) throw new ApiError("VALIDATION_FAILED", "At least one sermon field is required", 422);

    const { data, error } = await auth.client
      .from("sermons")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select()
      .single();
    if (error) throw new ApiError("SERMON_UPDATE_FAILED", "Unable to update sermon", 500, undefined, false);
    return { data };
  },
));
