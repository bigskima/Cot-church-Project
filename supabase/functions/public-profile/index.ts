import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertProfilesMayInteract } from "../_shared/safety.ts";
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

    return {
      data: {
        profile,
        counts: {
          followers: followersResult.count ?? 0,
          following: followingResult.count ?? 0,
        },
        viewer: {
          isSelf: auth?.user?.id === profile.id,
          isFollowing: Boolean(viewerFollowResult.data),
          canMessage: Boolean(auth?.user && auth.user.id !== profile.id),
        },
      },
    };
  },
));
