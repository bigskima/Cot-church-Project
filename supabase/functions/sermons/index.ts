import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const statuses = new Set(["draft", "review", "scheduled", "published", "archived"]);
const visibilities = new Set(["public", "organization", "branch", "group", "private"]);

Deno.serve(createHandler({ methods: ["GET", "POST", "PATCH"], authentication: "optional", organization: "optional" }, async ({ request, auth }) => {
  const url = new URL(request.url);
  const organizationId = auth?.organizationId ?? uuid(url.searchParams.get("organizationId"), "organizationId");

  if (request.method === "GET") {
    if (!organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    const sermonId = uuid(url.searchParams.get("id"), "id");
    const seriesSlug = url.searchParams.get("series");
    const queryTerm = url.searchParams.get("q");
    const client = auth?.client ?? (await import("../_shared/supabase.ts")).publicClient();

    if (url.searchParams.get("type") === "series") {
      const { data, error } = await client
        .from("sermon_series")
        .select("id, organization_id, expression_id, title, slug, description, artwork_url, starts_at, ends_at, is_featured")
        .eq("organization_id", organizationId)
        .order("starts_at", { ascending: false })
        .limit(50);
      if (error) throw new ApiError("SERIES_LIST_FAILED", "Unable to retrieve sermon series", 500, undefined, false);
      return { data: data ?? [] };
    }

    let query = client
      .from("sermons")
      .select("id, organization_id, expression_id, series_id, recording_id, title, slug, preacher, sermon_date, scripture_references, topics, description, transcript, audio_url, video_url, thumbnail_url, duration_seconds, status, visibility, is_featured, play_count, published_at")
      .eq("organization_id", organizationId);

    if (sermonId) {
      query = query.eq("id", sermonId);
    } else {
      if (!auth?.user) {
        query = query.eq("status", "published").eq("visibility", "public");
      }
      if (seriesSlug) {
        query = query.eq("series_id", seriesSlug);
      }
      if (queryTerm) {
        query = query.ilike("title", `%${queryTerm}%`);
      }
      query = query.order("sermon_date", { ascending: false }).limit(100);
    }

    const { data, error } = await query;
    if (error) throw new ApiError("SERMONS_LIST_FAILED", "Unable to retrieve sermons", 500, undefined, false);
    return { data: sermonId ? data?.[0] ?? null : data ?? [] };
  }

  if (!auth?.user || !auth?.organizationId) {
    throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
  }

  const body = assertObject(await jsonBody(request));

  if (request.method === "POST") {
    if (body.action === "convert_recording") {
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

      if (error) throw new ApiError("CONVERT_FAILED", error.message ?? "Unable to convert recording to sermon", 400);
      return { data, status: 201 };
    }

    await authorize(auth, "sermons.create");
    assertNoUnknownFields(body, ["title", "preacher", "sermonDate", "expressionId", "seriesId", "description", "transcript", "audioUrl", "videoUrl", "thumbnailUrl", "durationSeconds", "scriptures", "topics", "status", "visibility"]);

    const title = requiredString(body.title, "title", 200);
    const preacher = requiredString(body.preacher, "preacher", 120);
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    const status = optionalString(body.status, "status", 20) ?? "draft";
    const visibility = optionalString(body.visibility, "visibility", 20) ?? "public";

    if (!statuses.has(status) || !visibilities.has(visibility)) {
      throw new ApiError("VALIDATION_FAILED", "Invalid status or visibility", 422);
    }

    const record = {
      organization_id: auth.organizationId,
      expression_id: body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null,
      series_id: body.seriesId ? uuid(String(body.seriesId), "seriesId", true) : null,
      title,
      slug,
      preacher,
      sermon_date: optionalString(body.sermonDate, "sermonDate", 20) ?? new Date().toISOString().split("T")[0],
      description: optionalString(body.description, "description", 10000) ?? "",
      transcript: optionalString(body.transcript, "transcript", 500000),
      audio_url: optionalString(body.audioUrl, "audioUrl", 2000),
      video_url: optionalString(body.videoUrl, "videoUrl", 2000),
      thumbnail_url: optionalString(body.thumbnailUrl, "thumbnailUrl", 2000),
      duration_seconds: body.durationSeconds != null ? Number(body.durationSeconds) : null,
      scripture_references: Array.isArray(body.scriptures) ? body.scriptures : [],
      topics: Array.isArray(body.topics) ? body.topics : [],
      status,
      visibility,
      created_by: auth.user.id,
      published_at: status === "published" ? new Date().toISOString() : null,
    };

    const { data, error } = await auth.client.from("sermons").insert(record).select().single();
    if (error) throw new ApiError("SERMON_CREATE_FAILED", "Unable to create sermon", 500, undefined, false);
    return { data, status: 201 };
  }

  // PATCH
  await authorize(auth, "sermons.manage");
  assertNoUnknownFields(body, ["id", "title", "preacher", "sermonDate", "description", "transcript", "audioUrl", "videoUrl", "thumbnailUrl", "durationSeconds", "scriptures", "topics", "status", "visibility", "isFeatured"]);

  const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = requiredString(body.title, "title", 200);
  if (body.preacher !== undefined) updates.preacher = requiredString(body.preacher, "preacher", 120);
  if (body.sermonDate !== undefined) updates.sermon_date = requiredString(body.sermonDate, "sermonDate", 20);
  if (body.description !== undefined) updates.description = optionalString(body.description, "description", 10000) ?? "";
  if (body.transcript !== undefined) updates.transcript = optionalString(body.transcript, "transcript", 500000);
  if (body.audioUrl !== undefined) updates.audio_url = optionalString(body.audioUrl, "audioUrl", 2000);
  if (body.videoUrl !== undefined) updates.video_url = optionalString(body.videoUrl, "videoUrl", 2000);
  if (body.thumbnailUrl !== undefined) updates.thumbnail_url = optionalString(body.thumbnailUrl, "thumbnailUrl", 2000);
  if (body.durationSeconds !== undefined) updates.duration_seconds = body.durationSeconds != null ? Number(body.durationSeconds) : null;
  if (body.scriptures !== undefined && Array.isArray(body.scriptures)) updates.scripture_references = body.scriptures;
  if (body.topics !== undefined && Array.isArray(body.topics)) updates.topics = body.topics;
  if (body.isFeatured !== undefined) updates.is_featured = Boolean(body.isFeatured);

  if (body.status !== undefined) {
    const status = requiredString(body.status, "status", 20);
    if (!statuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid status", 422);
    updates.status = status;
    if (status === "published") updates.published_at = new Date().toISOString();
  }

  if (body.visibility !== undefined) {
    const visibility = requiredString(body.visibility, "visibility", 20);
    if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422);
    updates.visibility = visibility;
  }

  const { data, error } = await auth.client.from("sermons").update(updates).eq("id", id).eq("organization_id", auth.organizationId).select().single();
  if (error) throw new ApiError("SERMON_UPDATE_FAILED", "Unable to update sermon", 500, undefined, false);
  return { data };
});
