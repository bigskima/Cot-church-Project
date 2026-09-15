import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize, authorizeOrganization } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";

const PORTRAIT_BUCKET = "leadership-portraits";
const LOCATION_FIELDS = ["line1", "line2", "city", "state", "country", "landmark", "mapUrl", "latitude", "longitude"];

async function authorizeLeadershipScope(auth: any, expressionId: string | null) {
  if (expressionId) {
    if (!auth?.branchId || auth.branchId !== expressionId) {
      throw new ApiError("EXPRESSION_CONTEXT_MISMATCH", "Enter this exact Expression before managing its leaders", 403);
    }
    await authorize(auth, "expression.leadership.manage");
  } else {
    await authorizeOrganization(auth, "organization.leadership.manage");
  }
}

function textField(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return "";
  return requiredString(value, field, maxLength);
}

function normalizeLocation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_FAILED", "Location must be an object", 422);
  }
  const source = value as Record<string, unknown>;
  assertNoUnknownFields(source, LOCATION_FIELDS);
  const mapUrl = textField(source.mapUrl, "mapUrl", 2000);
  if (mapUrl) {
    try {
      const parsed = new URL(mapUrl);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("protocol");
    } catch {
      throw new ApiError("VALIDATION_FAILED", "Map URL must be a valid web address", 422);
    }
  }
  const latitude = source.latitude === undefined || source.latitude === null || source.latitude === "" ? null : Number(source.latitude);
  const longitude = source.longitude === undefined || source.longitude === null || source.longitude === "" ? null : Number(source.longitude);
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw new ApiError("VALIDATION_FAILED", "Latitude is invalid", 422);
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new ApiError("VALIDATION_FAILED", "Longitude is invalid", 422);
  return {
    line1: textField(source.line1, "line1", 300),
    line2: textField(source.line2, "line2", 300),
    city: textField(source.city, "city", 120),
    state: textField(source.state, "state", 120),
    country: textField(source.country, "country", 120),
    landmark: textField(source.landmark, "landmark", 300),
    mapUrl: mapUrl || null,
    latitude,
    longitude,
  };
}

function safePublicLocation(settings: unknown) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const value = (settings as Record<string, unknown>).public_location;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

Deno.serve(
  createHandler(
    { methods: ["GET", "POST", "PATCH"], authentication: "optional", organization: "optional" },
    async ({ request, auth }) => {
      const url = new URL(request.url);
      const organizationId = auth?.organizationId ?? uuid(url.searchParams.get("organizationId"), "organizationId");
      const client = auth?.client ?? publicClient();

      if (request.method === "GET") {
        const view = url.searchParams.get("view") ?? "all";
        const expressionId = uuid(url.searchParams.get("expressionId"), "expressionId");

        if (view === "leader-candidates") {
          if (!auth?.user || !auth.organizationId) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
          await authorizeLeadershipScope(auth, expressionId ?? null);
          const admin = adminClient();
          const normalized = (url.searchParams.get("q") ?? "").trim().replace(/^@/, "").toLowerCase();
          const limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || "100") || 100));

          if (expressionId) {
            const { data, error } = await admin
              .from("expression_memberships")
              .select("profile_id,joined_at,profile:profiles(id,display_name,username,avatar_url)")
              .eq("organization_id", auth.organizationId)
              .eq("branch_id", expressionId)
              .eq("status", "active")
              .order("joined_at", { ascending: true })
              .limit(limit);
            if (error) throw new ApiError("LEADER_CANDIDATES_FAILED", "Unable to retrieve Expression members", 500, undefined, false);
            const candidates = (data ?? []).filter((row: any) => {
              const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
              if (!normalized) return Boolean(profile);
              return [profile?.display_name, profile?.username]
                .filter(Boolean)
                .some((candidate) => String(candidate).toLowerCase().includes(normalized));
            });
            return { data: candidates };
          }

          const { data, error } = await admin
            .from("memberships")
            .select("profile_id,joined_at,profile:profiles(id,display_name,username,avatar_url)")
            .eq("organization_id", auth.organizationId)
            .eq("status", "active")
            .order("joined_at", { ascending: true })
            .limit(limit);
          if (error) throw new ApiError("LEADER_CANDIDATES_FAILED", "Unable to retrieve church members", 500, undefined, false);
          const candidates = (data ?? []).filter((row: any) => {
            const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
            if (!normalized) return Boolean(profile);
            return [profile?.display_name, profile?.username]
              .filter(Boolean)
              .some((candidate) => String(candidate).toLowerCase().includes(normalized));
          });
          return { data: candidates };
        }

        let storyData: any = null;
        let leadershipData: any = null;
        let locationData: any = null;

        if (view === "leadership-manage") {
          if (!auth?.user || !auth.organizationId) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
          await authorizeOrganization(auth, "organization.leadership.manage");
          const { data, error } = await auth.client
            .from("leadership_profiles")
            .select("id,organization_id,expression_id,profile_id,display_name,portrait_url,role_title,short_bio,full_bio,ministry,display_order,tenure_start,tenure_end,is_founder,is_featured_public,is_active,social_links,created_at,updated_at")
            .eq("organization_id", auth.organizationId)
            .is("expression_id", null)
            .order("is_founder", { ascending: false })
            .order("display_order", { ascending: true })
            .limit(100);
          if (error) throw new ApiError("LEADERSHIP_FETCH_FAILED", "Unable to retrieve church leadership profiles", 500, undefined, false);
          return { data: data ?? [] };
        }

        if (view === "all" || view === "story") {
          let query = publicClient()
            .from("church_story")
            .select("id,organization_id,title,subtitle,mission,vision,founding_story,founding_year,history_milestones,values,banner_image_url,is_published,created_at,updated_at")
            .eq("is_published", true);
          if (organizationId) query = query.eq("organization_id", organizationId);
          const { data, error } = await query.limit(1).maybeSingle();
          if (error) throw new ApiError("STORY_FETCH_FAILED", "Unable to retrieve the church story", 500, undefined, false);
          storyData = data ?? null;
        }

        if (view === "all" || view === "leadership") {
          if (expressionId && (!auth?.user || auth.branchId !== expressionId)) {
            throw new ApiError("EXPRESSION_MEMBERSHIP_REQUIRED", "Enter this Expression to view its internal leadership directory", 403);
          }
          let query = client
            .from("leadership_profiles")
            .select("id,organization_id,expression_id,profile_id,display_name,portrait_url,role_title,short_bio,full_bio,ministry,display_order,tenure_start,tenure_end,is_founder,is_featured_public,is_active,social_links,created_at,updated_at")
            .eq("is_active", true);
          if (organizationId) query = query.eq("organization_id", organizationId);
          if (expressionId) query = query.eq("expression_id", expressionId).order("display_order", { ascending: true });
          else query = query.eq("is_featured_public", true).order("is_founder", { ascending: false }).order("display_order", { ascending: true });
          const { data, error } = await query.limit(50);
          if (error) throw new ApiError("LEADERSHIP_FETCH_FAILED", "Unable to retrieve leadership profiles", 500, undefined, false);
          leadershipData = data ?? [];
        }

        if (view === "all" || view === "location") {
          let targetOrganizationId = organizationId ?? storyData?.organization_id ?? null;
          const admin = adminClient();
          if (!targetOrganizationId) {
            const { data: activeOrganizations, error } = await admin.from("organizations").select("id").eq("status", "active").order("created_at", { ascending: true }).limit(2);
            if (!error && (activeOrganizations ?? []).length === 1) targetOrganizationId = activeOrganizations![0].id;
          }
          if (targetOrganizationId) {
            const { data: organization, error } = await admin.from("organizations").select("id,name,settings").eq("id", targetOrganizationId).eq("status", "active").maybeSingle();
            if (error) throw new ApiError("LOCATION_FETCH_FAILED", "Unable to retrieve the church location", 500, undefined, false);
            locationData = organization ? safePublicLocation(organization.settings) : null;
          }
        }

        if (view === "story") return { data: storyData };
        if (view === "leadership") return { data: leadershipData };
        if (view === "location") return { data: locationData };
        return { data: { story: storyData, leadership: leadershipData, location: locationData } };
      }

      if (!auth?.user || !auth?.organizationId) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
      const body = assertObject(await jsonBody(request));

      if (request.method === "POST" && body.action === "create_portrait_upload") {
        assertNoUnknownFields(body, ["action", "mimeType", "expressionId"]);
        const expressionId = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
        await authorizeLeadershipScope(auth, expressionId);
        const mimeType = requiredString(body.mimeType, "mimeType", 80).toLowerCase();
        const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/jpeg" ? "jpg" : null;
        if (!extension) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Choose a JPG, PNG, or WebP portrait", 415);
        const path = `orgs/${auth.organizationId}/${auth.user.id}/${crypto.randomUUID()}.${extension}`;
        const admin = adminClient();
        const { data, error } = await admin.storage.from(PORTRAIT_BUCKET).createSignedUploadUrl(path, { upsert: false });
        if (error || !data?.signedUrl) throw new ApiError("UPLOAD_SESSION_FAILED", "Unable to prepare the leader photo upload", 500, undefined, false);
        return { data: { signedUploadUrl: data.signedUrl, publicUrl: admin.storage.from(PORTRAIT_BUCKET).getPublicUrl(path).data.publicUrl } };
      }

      if (request.method === "POST") {
        if (body.type === "story") {
          await authorizeOrganization(auth, "organization.leadership.manage");
          assertNoUnknownFields(body, ["type", "title", "subtitle", "mission", "vision", "foundingStory", "foundingYear", "milestones", "values", "bannerImageUrl"]);
          const record = {
            organization_id: auth.organizationId,
            title: requiredString(body.title, "title", 200),
            subtitle: optionalString(body.subtitle, "subtitle", 300) ?? "",
            mission: optionalString(body.mission, "mission", 5000) ?? "",
            vision: optionalString(body.vision, "vision", 5000) ?? "",
            founding_story: optionalString(body.foundingStory, "foundingStory", 20000) ?? "",
            founding_year: body.foundingYear != null && body.foundingYear !== "" ? Number(body.foundingYear) : null,
            history_milestones: Array.isArray(body.milestones) ? body.milestones : [],
            values: Array.isArray(body.values) ? body.values : [],
            banner_image_url: optionalString(body.bannerImageUrl, "bannerImageUrl", 2000),
            updated_by: auth.user.id,
            is_published: true,
          };
          const { data, error } = await auth.client.from("church_story").upsert(record, { onConflict: "organization_id" }).select().single();
          if (error) throw new ApiError("STORY_SAVE_FAILED", "Unable to save church story", 500, undefined, false);
          return { data, status: 201 };
        }

        if (body.type === "location") {
          await authorizeOrganization(auth, "organization.leadership.manage");
          assertNoUnknownFields(body, ["type", "location"]);
          const location = normalizeLocation(body.location);
          const admin = adminClient();
          const { data: organization, error: loadError } = await admin.from("organizations").select("settings").eq("id", auth.organizationId).maybeSingle();
          if (loadError || !organization) throw new ApiError("LOCATION_SAVE_FAILED", "Unable to load church settings", 500, undefined, false);
          const settings = organization.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings)
            ? organization.settings as Record<string, unknown>
            : {};
          const { error } = await admin.from("organizations").update({ settings: { ...settings, public_location: location } }).eq("id", auth.organizationId);
          if (error) throw new ApiError("LOCATION_SAVE_FAILED", "Unable to save the church location", 500, undefined, false);
          return { data: location };
        }

        const expressionId = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
        await authorizeLeadershipScope(auth, expressionId);
        assertNoUnknownFields(body, ["type", "expressionId", "profileId", "displayName", "portraitUrl", "roleTitle", "shortBio", "fullBio", "ministry", "displayOrder", "isFounder", "isFeaturedPublic", "socialLinks"]);
        const record = {
          organization_id: auth.organizationId,
          expression_id: expressionId,
          profile_id: body.profileId ? uuid(String(body.profileId), "profileId", true) : null,
          display_name: requiredString(body.displayName, "displayName", 120),
          portrait_url: optionalString(body.portraitUrl, "portraitUrl", 2000),
          role_title: requiredString(body.roleTitle, "roleTitle", 120),
          short_bio: optionalString(body.shortBio, "shortBio", 1000) ?? "",
          full_bio: optionalString(body.fullBio, "fullBio", 10000) ?? "",
          ministry: optionalString(body.ministry, "ministry", 120),
          display_order: body.displayOrder != null ? Number(body.displayOrder) : 0,
          is_founder: Boolean(body.isFounder),
          is_featured_public: Boolean(body.isFeaturedPublic),
          is_active: true,
          social_links: typeof body.socialLinks === "object" ? body.socialLinks : {},
          created_by: auth.user.id,
          updated_by: auth.user.id,
        };
        const { data, error } = await auth.client.from("leadership_profiles").insert(record).select().single();
        if (error) throw new ApiError("LEADERSHIP_CREATE_FAILED", "Unable to create leadership profile", 500, undefined, false);
        return { data, status: 201 };
      }

      const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
      const { data: existing, error: fetchErr } = await auth.client.from("leadership_profiles").select("organization_id,expression_id").eq("id", id).single();
      if (fetchErr || !existing) throw new ApiError("NOT_FOUND", "Leadership profile not found", 404);
      await authorizeLeadershipScope(auth, existing.expression_id);
      assertNoUnknownFields(body, ["id", "displayName", "portraitUrl", "roleTitle", "shortBio", "fullBio", "ministry", "displayOrder", "isFounder", "isFeaturedPublic", "isActive", "socialLinks"]);
      const updates: Record<string, unknown> = { updated_by: auth.user.id };
      if (body.displayName !== undefined) updates.display_name = requiredString(body.displayName, "displayName", 120);
      if (body.portraitUrl !== undefined) updates.portrait_url = optionalString(body.portraitUrl, "portraitUrl", 2000);
      if (body.roleTitle !== undefined) updates.role_title = requiredString(body.roleTitle, "roleTitle", 120);
      if (body.shortBio !== undefined) updates.short_bio = optionalString(body.shortBio, "shortBio", 1000);
      if (body.fullBio !== undefined) updates.full_bio = optionalString(body.fullBio, "fullBio", 10000);
      if (body.ministry !== undefined) updates.ministry = optionalString(body.ministry, "ministry", 120);
      if (body.displayOrder !== undefined) updates.display_order = Number(body.displayOrder);
      if (body.isFounder !== undefined) updates.is_founder = Boolean(body.isFounder);
      if (body.isFeaturedPublic !== undefined) updates.is_featured_public = Boolean(body.isFeaturedPublic);
      if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);
      if (body.socialLinks !== undefined && typeof body.socialLinks === "object") updates.social_links = body.socialLinks;
      const { data, error } = await auth.client.from("leadership_profiles").update(updates).eq("id", id).select().single();
      if (error) throw new ApiError("LEADERSHIP_UPDATE_FAILED", "Unable to update leadership profile", 500, undefined, false);
      return { data };
    },
  ),
);