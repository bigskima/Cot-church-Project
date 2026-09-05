import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const reactionTypes = new Set(["heart", "prayer", "fire", "amen"]);
const followUpTypes = new Set(["prayer_request", "altar_response", "counselling", "membership_interest"]);

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const streamId = uuid(url.searchParams.get("streamId"), "streamId", true)!;

      const { data: allowed, error: accessError } = await auth.client.rpc("can_access_stream", {
        target_stream_id: streamId,
      });
      if (accessError || allowed !== true) {
        throw new ApiError("INTERACTION_DENIED", "This broadcast is not available to you", 403);
      }

      const admin = adminClient();
      const { data: rows, error } = await admin
        .from("stream_messages")
        .select("id,membership_id,body,created_at")
        .eq("stream_id", streamId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new ApiError("CHAT_FETCH_FAILED", "Unable to load live chat", 500, undefined, false);

      const ordered = [...(rows ?? [])].reverse();
      const membershipIds = [...new Set(ordered.map((row) => row.membership_id).filter(Boolean))] as string[];
      const { data: memberships, error: membershipError } = membershipIds.length
        ? await admin.from("memberships").select("id,profile_id").in("id", membershipIds)
        : { data: [], error: null };
      if (membershipError) throw new ApiError("CHAT_FETCH_FAILED", "Unable to resolve live chat members", 500, undefined, false);

      const membershipMap = new Map((memberships ?? []).map((row: any) => [row.id, row.profile_id]));
      const profileIds = [...new Set((memberships ?? []).map((row: any) => row.profile_id).filter(Boolean))] as string[];
      const { data: profiles, error: profileError } = profileIds.length
        ? await admin.from("profiles").select("id,display_name,avatar_url").in("id", profileIds)
        : { data: [], error: null };
      if (profileError) throw new ApiError("CHAT_FETCH_FAILED", "Unable to resolve live chat profiles", 500, undefined, false);

      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

      return {
        data: ordered.map((row: any) => {
          const profileId = membershipMap.get(row.membership_id);
          const profile = profileId ? profileMap.get(profileId) : null;
          return {
            id: row.id,
            profileId: profileId ?? null,
            user: profile?.display_name ?? "Member",
            avatarUrl: profile?.avatar_url ?? null,
            text: row.body,
            createdAt: row.created_at,
          };
        }),
      };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["streamId", "action", "reaction", "message", "type"]);

    const streamId = uuid(requiredString(body.streamId, "streamId", 36), "streamId", true)!;
    const action = requiredString(body.action, "action", 20);

    let value: string;
    if (action === "react") {
      value = requiredString(body.reaction, "reaction", 20);
      if (!reactionTypes.has(value)) throw new ApiError("VALIDATION_FAILED", "Invalid live reaction", 422);
    } else if (action === "chat") {
      value = requiredString(body.message, "message", 1000);
    } else if (action === "follow_up") {
      value = requiredString(body.type, "type", 40);
      if (!followUpTypes.has(value)) throw new ApiError("VALIDATION_FAILED", "Invalid pastoral follow-up type", 422);
    } else {
      throw new ApiError("VALIDATION_FAILED", "Invalid live interaction action", 422);
    }

    const { data, error } = await auth.client.rpc("add_stream_interaction", {
      target_stream_id: streamId,
      interaction_action: action,
      interaction_value: value,
    });
    if (error?.code === "42501") {
      throw new ApiError("INTERACTION_DENIED", error.message || "This action is not available to you", 403);
    }
    if (error) throw new ApiError("INTERACTION_FAILED", "Unable to complete this live action", 400);
    return { data };
  },
));
