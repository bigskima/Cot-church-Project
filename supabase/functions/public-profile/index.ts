import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertProfilesMayInteract } from "../_shared/safety.ts";
import { enrichSocialPosts } from "../_shared/public-identity.ts";
import { uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "optional", organization: "none" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const username = (url.searchParams.get("username") ?? "").trim().replace(/^@/, "").toLowerCase();
    const profileId = uuid(url.searchParams.get("profileId"), "profileId");
    if (!username && !profileId) throw new ApiError("VALIDATION_FAILED", "username or profileId is required", 422);
    if (username && !/^[a-z0-9][a-z0-9._]{2,29}$/.test(username)) {
      throw new ApiError("VALIDATION_FAILED", "Invalid username", 422);
    }

    const admin = adminClient();
    let profileQuery = admin
      .from("profiles")
      .select("id,display_name,username,avatar_url,banner_url,bio,created_at");
    profileQuery = profileId ? profileQuery.eq("id", profileId) : profileQuery.eq("username", username);

    const { data: profile, error: profileError } = await profileQuery.maybeSingle();
    if (profileError) throw new ApiError("PROFILE_LOOKUP_FAILED", "Unable to load this profile", 500, undefined, false);
    if (!profile) throw new ApiError("PROFILE_NOT_FOUND", "This profile is unavailable", 404);

    if (auth?.user && auth.user.id !== profile.id) {
      await assertProfilesMayInteract(admin, auth.user.id, profile.id);
    }

    const view = url.searchParams.get("view") ?? "profile";
    if (!["profile", "followers", "following"].includes(view)) {
      throw new ApiError("VALIDATION_FAILED", "view must be profile, followers, or following", 422);
    }

    const [followersResult, followingResult, viewerFollowResult] = await Promise.all([
      admin
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("target_profile_id", profile.id),
      admin
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .not("target_profile_id", "is", null),
      auth?.user && auth.user.id !== profile.id
        ? admin
            .from("follows")
            .select("id")
            .eq("profile_id", auth.user.id)
            .eq("target_profile_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (followersResult.error || followingResult.error || viewerFollowResult.error) {
      throw new ApiError("PROFILE_SOCIAL_GRAPH_FAILED", "Unable to load follow information", 500, undefined, false);
    }

    const { data: badgeRows, error: badgeError } = await admin
      .from("identity_badge_assignments")
      .select("organization_id,branch_id,identity_badge_definitions!inner(id,code,label,background_color,text_color,priority,badge_variant,is_active),organizations(name)")
      .eq("profile_id", profile.id)
      .is("branch_id", null)
      .eq("is_active", true)
      .eq("identity_badge_definitions.is_active", true)
      .limit(20);
    if (badgeError) {
      throw new ApiError("PROFILE_BADGES_FAILED", "Unable to load this member's public ministry titles", 500, undefined, false);
    }
    const publicBadges = (badgeRows ?? [])
      .map((row: any) => {
        const definition = Array.isArray(row.identity_badge_definitions) ? row.identity_badge_definitions[0] : row.identity_badge_definitions;
        const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
        return definition ? {
          id: definition.id,
          code: definition.code,
          label: definition.label,
          backgroundColor: definition.background_color,
          textColor: definition.text_color,
          priority: Number(definition.priority ?? 0),
          badgeVariant: definition.badge_variant ?? "default",
          organizationId: row.organization_id,
          organizationName: organization?.name ?? null,
        } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.priority - a.priority);

    const profileWithBadges = { ...profile, badges: publicBadges };

    const counts = {
      followers: followersResult.count ?? 0,
      following: followingResult.count ?? 0,
    };
    const viewer = {
      isSelf: auth?.user?.id === profile.id,
      isFollowing: Boolean(viewerFollowResult.data),
      canMessage: Boolean(auth?.user && auth.user.id !== profile.id),
    };

    if (view === "followers" || view === "following") {
      const connectionResult = view === "followers"
        ? await admin.from("follows")
            .select("profile_id,created_at")
            .eq("target_profile_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(1000)
        : await admin.from("follows")
            .select("target_profile_id,created_at")
            .eq("profile_id", profile.id)
            .not("target_profile_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1000);
      if (connectionResult.error) {
        throw new ApiError("PROFILE_CONNECTIONS_FAILED", "Unable to load this connection list", 500, undefined, false);
      }
      const ids = [...new Set((connectionResult.data ?? [])
        .map((row: any) => view === "followers" ? row.profile_id : row.target_profile_id)
        .filter(Boolean))];
      const { data: peopleRows, error: peopleError } = ids.length
        ? await admin.from("profiles")
            .select("id,display_name,username,avatar_url,bio")
            .in("id", ids)
        : { data: [] as any[], error: null };
      if (peopleError) {
        throw new ApiError("PROFILE_CONNECTIONS_FAILED", "Unable to load connected profiles", 500, undefined, false);
      }
      const peopleMap = new Map((peopleRows ?? []).map((person: any) => [person.id, person]));
      const viewerFollows = new Set<string>();
      if (auth?.user && ids.length) {
        const { data: viewerRows, error: viewerError } = await admin.from("follows")
          .select("target_profile_id")
          .eq("profile_id", auth.user.id)
          .in("target_profile_id", ids);
        if (viewerError) {
          throw new ApiError("PROFILE_CONNECTIONS_FAILED", "Unable to resolve follow state", 500, undefined, false);
        }
        for (const row of viewerRows ?? []) {
          if ((row as any).target_profile_id) viewerFollows.add((row as any).target_profile_id);
        }
      }
      const people = ids
        .map((id) => peopleMap.get(id))
        .filter(Boolean)
        .map((person: any) => ({
          ...person,
          viewerFollows: auth?.user?.id === person.id ? null : viewerFollows.has(person.id),
          isSelf: auth?.user?.id === person.id,
        }));
      return { data: { profile: profileWithBadges, counts, viewer, view, people } };
    }

    const { data: memberships, error: membershipsError } = await admin
      .from("memberships")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "active");
    if (membershipsError) {
      throw new ApiError("PROFILE_POSTS_FAILED", "Unable to resolve this member's published content", 500, undefined, false);
    }
    const membershipIds = (memberships ?? []).map((membership: any) => membership.id);
    const { data: posts, error: postsError } = membershipIds.length
      ? await admin.from("social_posts")
          .select("id,organization_id,author_membership_id,branch_id,group_id,visibility,status,body,media,published_at,edited_at,created_at,updated_at")
          .in("author_membership_id", membershipIds)
          .eq("visibility", "public")
          .is("branch_id", null)
          .is("group_id", null)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(100)
      : { data: [] as any[], error: null };
    if (postsError) {
      throw new ApiError("PROFILE_POSTS_FAILED", "Unable to load this member's published content", 500, undefined, false);
    }

    const enrichedPosts = await enrichSocialPosts(posts ?? []);
    return {
      data: {
        profile: profileWithBadges,
        counts,
        viewer,
        posts: enrichedPosts,
      },
    };
  },
));
