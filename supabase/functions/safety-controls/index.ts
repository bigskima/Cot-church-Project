import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const modes = new Set(["mute", "block"]);

Deno.serve(createHandler(
  { methods: ["GET", "POST", "DELETE"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Please sign in to manage safety controls", 401);
    const admin = adminClient();

    const loadList = async () => {
      const { data: relationships, error } = await admin
        .from("profile_safety_relationships")
        .select("target_profile_id,mode,created_at,updated_at")
        .eq("owner_profile_id", auth.user.id)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw new ApiError("SAFETY_LIST_FAILED", "Unable to load blocked and muted accounts", 500, undefined, false);

      const ids = (relationships ?? []).map((row) => row.target_profile_id);
      const { data: profiles, error: profilesError } = ids.length
        ? await admin
            .from("profiles")
            .select("id,display_name,username,avatar_url")
            .in("id", ids)
        : { data: [], error: null };
      if (profilesError) throw new ApiError("SAFETY_LIST_FAILED", "Unable to load account details", 500, undefined, false);

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      return (relationships ?? []).map((relationship) => {
        const profile: any = profileMap.get(relationship.target_profile_id);
        return {
          profileId: relationship.target_profile_id,
          mode: relationship.mode,
          createdAt: relationship.created_at,
          updatedAt: relationship.updated_at,
          displayName: profile?.display_name ?? "COT member",
          username: profile?.username ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        };
      });
    };

    if (request.method === "GET") {
      return { data: { items: await loadList() } };
    }

    const body = assertObject(await jsonBody(request));

    if (request.method === "DELETE") {
      assertNoUnknownFields(body, ["targetProfileId"]);
      const targetProfileId = uuid(requiredString(body.targetProfileId, "targetProfileId", 64), "targetProfileId", true)!;
      const { error } = await admin
        .from("profile_safety_relationships")
        .delete()
        .eq("owner_profile_id", auth.user.id)
        .eq("target_profile_id", targetProfileId);
      if (error) throw new ApiError("SAFETY_UPDATE_FAILED", "Unable to update this safety preference", 500, undefined, false);
      return { data: { targetProfileId, mode: null, items: await loadList() } };
    }

    assertNoUnknownFields(body, ["targetProfileId", "mode"]);
    const targetProfileId = uuid(requiredString(body.targetProfileId, "targetProfileId", 64), "targetProfileId", true)!;
    const mode = requiredString(body.mode, "mode", 20);
    if (!modes.has(mode)) throw new ApiError("VALIDATION_FAILED", "Choose mute or block", 422);
    if (targetProfileId === auth.user.id) throw new ApiError("VALIDATION_FAILED", "You cannot mute or block your own account", 422);

    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", targetProfileId)
      .maybeSingle();
    if (targetError || !targetProfile) throw new ApiError("PROFILE_NOT_FOUND", "This account is unavailable", 404);

    const { error } = await admin
      .from("profile_safety_relationships")
      .upsert({
        owner_profile_id: auth.user.id,
        target_profile_id: targetProfileId,
        mode,
      }, { onConflict: "owner_profile_id,target_profile_id" });
    if (error) throw new ApiError("SAFETY_UPDATE_FAILED", "Unable to update this safety preference", 500, undefined, false);

    return {
      data: {
        targetProfileId,
        mode,
        items: await loadList(),
      },
    };
  },
));
