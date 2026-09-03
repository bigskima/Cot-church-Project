import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const MEDIA_BUCKET = "public-directory-media";
const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);

function nullableString(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}`, 422);
  }
  return value.trim();
}

function bool(value: unknown, field: string, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new ApiError("VALIDATION_FAILED", `${field} must be boolean`, 422);
  return value;
}

function integer(value: unknown, field: string, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < -100000 || parsed > 100000) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an integer`, 422);
  }
  return parsed;
}

function year(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  const current = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > current) {
    throw new ApiError("VALIDATION_FAILED", "Invalid founding year", 422);
  }
  return parsed;
}

function jsonArray(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ApiError("VALIDATION_FAILED", `${field} must be an array`, 422);
  return value;
}

function jsonObject(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an object`, 422);
  }
  return value as Record<string, unknown>;
}

function extensionFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function ensureOrganization(organizationId: string) {
  const { data, error } = await adminClient()
    .from("organizations")
    .select("id,name,status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "Church organization not found", 404);
  return data;
}

async function audit(actorProfileId: string, action: string, targetType: string, targetId: string | null, requestId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await adminClient().from("platform_audit_log").insert({
    actor_profile_id: actorProfileId,
    action,
    target_type: targetType,
    target_id: targetId,
    request_id: requestId,
    metadata,
  });
  if (error) throw new ApiError("AUDIT_FAILED", "Unable to record governance action", 500, undefined, false);
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH", "DELETE"], authentication: "required", organization: "none" },
  async ({ request, requestId, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    await authorizePlatform(auth, "platform.public_directory.manage");
    const admin = adminClient();

    if (request.method === "GET") {
      const url = new URL(request.url);
      const organizationParam = url.searchParams.get("organizationId");
      const organizationId = organizationParam ? uuid(organizationParam, "organizationId", true)! : null;

      const organizationsResult = await admin
        .from("organizations")
        .select("id,name,slug,status")
        .order("name", { ascending: true });
      if (organizationsResult.error) throw new ApiError("PUBLIC_DIRECTORY_FAILED", "Unable to retrieve organizations", 500, undefined, false);

      if (!organizationId) {
        return { data: { organizations: organizationsResult.data ?? [], story: null, leaders: [] } };
      }
      await ensureOrganization(organizationId);

      const [storyResult, leadersResult] = await Promise.all([
        admin.from("church_story").select("*").eq("organization_id", organizationId).maybeSingle(),
        admin
          .from("leadership_profiles")
          .select("id,organization_id,profile_id,display_name,portrait_url,role_title,short_bio,full_bio,ministry,display_order,tenure_start,tenure_end,is_founder,is_featured_public,is_active,social_links,created_at,updated_at")
          .eq("organization_id", organizationId)
          .is("expression_id", null)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (storyResult.error || leadersResult.error) {
        throw new ApiError("PUBLIC_DIRECTORY_FAILED", "Unable to retrieve public directory", 500, undefined, false);
      }
      return {
        data: {
          organizations: organizationsResult.data ?? [],
          story: storyResult.data ?? null,
          leaders: leadersResult.data ?? [],
        },
      };
    }

    if (request.method === "DELETE") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["action", "organizationId", "leaderId", "mediaPath"]);
      const action = requiredString(body.action, "action", 40);
      const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
      await ensureOrganization(organizationId);

      if (action === "archive_leader") {
        const leaderId = uuid(requiredString(body.leaderId, "leaderId", 64), "leaderId", true)!;
        const { data: existing, error: existingError } = await admin
          .from("leadership_profiles")
          .select("id,expression_id")
          .eq("id", leaderId)
          .eq("organization_id", organizationId)
          .is("expression_id", null)
          .maybeSingle();
        if (existingError || !existing) throw new ApiError("LEADER_NOT_FOUND", "Central leader profile not found", 404);
        const { error } = await admin.from("leadership_profiles").update({ is_active: false, updated_by: auth.user.id }).eq("id", leaderId);
        if (error) throw new ApiError("LEADER_UPDATE_FAILED", "Unable to archive leader profile", 500, undefined, false);
        await audit(auth.user.id, "public_directory.leader_archived", "leadership_profile", leaderId, requestId, { organizationId });
        return { data: { archived: true } };
      }

      if (action === "delete_media") {
        const mediaPath = requiredString(body.mediaPath, "mediaPath", 512);
        if (!mediaPath.startsWith(`${organizationId}/`)) throw new ApiError("MEDIA_SCOPE_DENIED", "Media does not belong to this organization", 403);
        const { error } = await admin.storage.from(MEDIA_BUCKET).remove([mediaPath]);
        if (error) throw new ApiError("MEDIA_DELETE_FAILED", "Unable to remove public directory media", 500, undefined, false);
        return { data: { deleted: true } };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported action", 422);
    }

    const body = assertObject(await jsonBody(request));
    const action = requiredString(body.action, "action", 40);

    if (action === "create_upload") {
      assertNoUnknownFields(body, ["action", "organizationId", "mimeType", "sizeBytes", "fileName"]);
      const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
      await ensureOrganization(organizationId);
      const mimeType = requiredString(body.mimeType, "mimeType", 80).toLowerCase();
      if (!allowedMimes.has(mimeType)) throw new ApiError("MEDIA_TYPE_UNSUPPORTED", "Use a JPG, PNG, or WebP image", 422);
      const sizeBytes = Number(body.sizeBytes);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 8 * 1024 * 1024) {
        throw new ApiError("MEDIA_SIZE_INVALID", "Image must be 8 MB or smaller", 422);
      }
      const mediaPath = `${organizationId}/${crypto.randomUUID()}.${extensionFor(mimeType)}`;
      const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(mediaPath);
      if (error || !data?.signedUrl) throw new ApiError("MEDIA_UPLOAD_FAILED", "Unable to prepare image upload", 500, undefined, false);
      return { data: { mediaPath, signedUploadUrl: data.signedUrl, mimeType } };
    }

    if (action === "complete_upload") {
      assertNoUnknownFields(body, ["action", "organizationId", "mediaPath"]);
      const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
      const mediaPath = requiredString(body.mediaPath, "mediaPath", 512);
      if (!mediaPath.startsWith(`${organizationId}/`)) throw new ApiError("MEDIA_SCOPE_DENIED", "Media does not belong to this organization", 403);
      const pieces = mediaPath.split("/");
      const fileName = pieces.pop()!;
      const folder = pieces.join("/");
      const { data: objects, error: listError } = await admin.storage.from(MEDIA_BUCKET).list(folder, { search: fileName, limit: 10 });
      if (listError || !(objects ?? []).some((item) => item.name === fileName)) {
        throw new ApiError("MEDIA_UPLOAD_INCOMPLETE", "Uploaded image could not be verified", 409);
      }
      const { data } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(mediaPath);
      return { data: { mediaPath, publicUrl: data.publicUrl } };
    }

    if (action === "upsert_story") {
      assertNoUnknownFields(body, ["action", "organizationId", "title", "subtitle", "mission", "vision", "foundingStory", "foundingYear", "historyMilestones", "values", "bannerImageUrl", "isPublished"]);
      const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
      await ensureOrganization(organizationId);
      const payload = {
        organization_id: organizationId,
        title: requiredString(body.title, "title", 160),
        subtitle: nullableString(body.subtitle, "subtitle", 240) ?? "",
        mission: nullableString(body.mission, "mission", 5000) ?? "",
        vision: nullableString(body.vision, "vision", 5000) ?? "",
        founding_story: nullableString(body.foundingStory, "foundingStory", 12000) ?? "",
        founding_year: year(body.foundingYear),
        history_milestones: jsonArray(body.historyMilestones, "historyMilestones") ?? [],
        values: jsonArray(body.values, "values") ?? [],
        banner_image_url: nullableString(body.bannerImageUrl, "bannerImageUrl", 2048),
        is_published: bool(body.isPublished, "isPublished", false),
        updated_by: auth.user.id,
      };
      const { data, error } = await admin.from("church_story").upsert(payload, { onConflict: "organization_id" }).select().single();
      if (error) throw new ApiError("STORY_SAVE_FAILED", "Unable to save public church story", 500, undefined, false);
      await audit(auth.user.id, "public_directory.story_saved", "church_story", data.id, requestId, { organizationId, published: data.is_published });
      return { data };
    }

    if (action === "create_leader" || action === "update_leader") {
      assertNoUnknownFields(body, ["action", "organizationId", "leaderId", "displayName", "portraitUrl", "roleTitle", "shortBio", "fullBio", "ministry", "displayOrder", "tenureStart", "tenureEnd", "isFounder", "isFeaturedPublic", "isActive", "socialLinks"]);
      const organizationId = uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;
      await ensureOrganization(organizationId);
      const leaderPayload = {
        organization_id: organizationId,
        expression_id: null,
        display_name: requiredString(body.displayName, "displayName", 120),
        portrait_url: nullableString(body.portraitUrl, "portraitUrl", 2048),
        role_title: requiredString(body.roleTitle, "roleTitle", 120),
        short_bio: nullableString(body.shortBio, "shortBio", 1200) ?? "",
        full_bio: nullableString(body.fullBio, "fullBio", 12000) ?? "",
        ministry: nullableString(body.ministry, "ministry", 160),
        display_order: integer(body.displayOrder, "displayOrder", 0),
        tenure_start: nullableString(body.tenureStart, "tenureStart", 10),
        tenure_end: nullableString(body.tenureEnd, "tenureEnd", 10),
        is_founder: bool(body.isFounder, "isFounder", false),
        is_featured_public: bool(body.isFeaturedPublic, "isFeaturedPublic", true),
        is_active: bool(body.isActive, "isActive", true),
        social_links: jsonObject(body.socialLinks, "socialLinks") ?? {},
        updated_by: auth.user.id,
      };

      if (action === "create_leader") {
        const { data, error } = await admin.from("leadership_profiles").insert({ ...leaderPayload, created_by: auth.user.id }).select().single();
        if (error) throw new ApiError("LEADER_CREATE_FAILED", "Unable to create central leader profile", 500, undefined, false);
        await audit(auth.user.id, "public_directory.leader_created", "leadership_profile", data.id, requestId, { organizationId });
        return { data, status: 201 };
      }

      const leaderId = uuid(requiredString(body.leaderId, "leaderId", 64), "leaderId", true)!;
      const { data: existing, error: existingError } = await admin
        .from("leadership_profiles")
        .select("id")
        .eq("id", leaderId)
        .eq("organization_id", organizationId)
        .is("expression_id", null)
        .maybeSingle();
      if (existingError || !existing) throw new ApiError("LEADER_NOT_FOUND", "Central leader profile not found", 404);
      const { data, error } = await admin.from("leadership_profiles").update(leaderPayload).eq("id", leaderId).select().single();
      if (error) throw new ApiError("LEADER_UPDATE_FAILED", "Unable to update central leader profile", 500, undefined, false);
      await audit(auth.user.id, "public_directory.leader_updated", "leadership_profile", leaderId, requestId, { organizationId });
      return { data };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported action", 422);
  },
));
