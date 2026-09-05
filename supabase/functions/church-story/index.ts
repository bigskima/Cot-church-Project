import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";
import { publicClient } from "../_shared/supabase.ts";

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

        let storyData = null;
        let leadershipData = null;

        if (view === "leadership-manage") {
          if (!auth?.user || !auth.organizationId) {
            throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
          }
          await authorize(auth, "organization.leadership.manage");
          const { data, error } = await auth.client
            .from("leadership_profiles")
            .select("id, organization_id, expression_id, profile_id, display_name, portrait_url, role_title, short_bio, full_bio, ministry, display_order, tenure_start, tenure_end, is_founder, is_featured_public, is_active, social_links, created_at, updated_at")
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
            .select("id, organization_id, title, subtitle, mission, vision, founding_story, founding_year, history_milestones, values, banner_image_url, is_published, created_at, updated_at")
            .eq("is_published", true);

          if (organizationId) {
            query = query.eq("organization_id", organizationId);
          }
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
            .select("id, organization_id, expression_id, profile_id, display_name, portrait_url, role_title, short_bio, full_bio, ministry, display_order, tenure_start, tenure_end, is_founder, is_featured_public, is_active, social_links, created_at, updated_at")
            .eq("is_active", true);

          if (organizationId) {
            query = query.eq("organization_id", organizationId);
          }

          if (expressionId) {
            query = query.eq("expression_id", expressionId).order("display_order", { ascending: true });
          } else {
            query = query.eq("is_featured_public", true).order("is_founder", { ascending: false }).order("display_order", { ascending: true });
          }

          const { data, error } = await query.limit(50);
          if (error) throw new ApiError("LEADERSHIP_FETCH_FAILED", "Unable to retrieve leadership profiles", 500, undefined, false);
          leadershipData = data ?? [];
        }

        if (view === "story") return { data: storyData };
        if (view === "leadership") return { data: leadershipData };
        return { data: { story: storyData, leadership: leadershipData } };
      }

      // Authenticated POST / PATCH
      if (!auth?.user || !auth?.organizationId) {
        throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
      }

      const body = assertObject(await jsonBody(request));

      if (request.method === "POST") {
        if (body.type === "story") {
          await authorize(auth, "organization.leadership.manage");
          assertNoUnknownFields(body, ["type", "title", "subtitle", "mission", "vision", "foundingStory", "foundingYear", "milestones", "values", "bannerImageUrl"]);

          const record = {
            organization_id: auth.organizationId,
            title: requiredString(body.title, "title", 200),
            subtitle: optionalString(body.subtitle, "subtitle", 300) ?? "",
            mission: optionalString(body.mission, "mission", 5000) ?? "",
            vision: optionalString(body.vision, "vision", 5000) ?? "",
            founding_story: optionalString(body.foundingStory, "foundingStory", 20000) ?? "",
            founding_year: body.foundingYear != null ? Number(body.foundingYear) : 2010,
            history_milestones: Array.isArray(body.milestones) ? body.milestones : [],
            values: Array.isArray(body.values) ? body.values : [],
            banner_image_url: optionalString(body.bannerImageUrl, "bannerImageUrl", 2000),
            updated_by: auth.user.id,
            is_published: true,
          };

          const { data, error } = await auth.client
            .from("church_story")
            .upsert(record, { onConflict: "organization_id" })
            .select()
            .single();

          if (error) throw new ApiError("STORY_SAVE_FAILED", "Unable to save church story", 500, undefined, false);
          return { data, status: 201 };
        }

        // Leadership profile create
        const expressionId = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
        if (expressionId) {
          await authorize(auth, "expression.leadership.manage");
        } else {
          await authorize(auth, "organization.leadership.manage");
        }

        assertNoUnknownFields(body, [
          "type",
          "expressionId",
          "profileId",
          "displayName",
          "portraitUrl",
          "roleTitle",
          "shortBio",
          "fullBio",
          "ministry",
          "displayOrder",
          "isFounder",
          "isFeaturedPublic",
          "socialLinks",
        ]);

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

      // PATCH leadership profile
      const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
      const { data: existing, error: fetchErr } = await auth.client
        .from("leadership_profiles")
        .select("organization_id, expression_id")
        .eq("id", id)
        .single();

      if (fetchErr || !existing) throw new ApiError("NOT_FOUND", "Leadership profile not found", 404);

      if (existing.expression_id) {
        await authorize(auth, "expression.leadership.manage");
      } else {
        await authorize(auth, "organization.leadership.manage");
      }

      assertNoUnknownFields(body, [
        "id",
        "displayName",
        "portraitUrl",
        "roleTitle",
        "shortBio",
        "fullBio",
        "ministry",
        "displayOrder",
        "isFounder",
        "isFeaturedPublic",
        "isActive",
        "socialLinks",
      ]);

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

      const { data, error } = await auth.client
        .from("leadership_profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new ApiError("LEADERSHIP_UPDATE_FAILED", "Unable to update leadership profile", 500, undefined, false);
      return { data };
    }
  )
);
