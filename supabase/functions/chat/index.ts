import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertProfilesMayInteract, loadSafetyProfileSets } from "../_shared/safety.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

function normalizeUsername(value: unknown) {
  const username = requiredString(value, "username", 30).trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,29}$/.test(username)) {
    throw new ApiError("VALIDATION_FAILED", "Enter a valid username", 422);
  }
  return username;
}

function pairFor(first: string, second: string) {
  return first.localeCompare(second) < 0
    ? { participant_low: first, participant_high: second }
    : { participant_low: second, participant_high: first };
}

function publicProfile(profile: any) {
  return profile ? {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    banner_url: profile.banner_url,
  } : null;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Please sign in to use chat.", 401);

    const admin = adminClient();
    const viewerId = auth.user.id;
    const url = new URL(request.url);

    if (request.method === "GET") {
      const conversationId = uuid(url.searchParams.get("conversationId"), "conversationId");
      if (conversationId) {
        const { data: conversation, error: conversationError } = await admin
          .from("direct_conversations")
          .select("id,participant_low,participant_high,created_at,updated_at")
          .eq("id", conversationId)
          .maybeSingle();

        if (conversationError) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t load this conversation.", 500, undefined, false);
        if (!conversation || ![conversation.participant_low, conversation.participant_high].includes(viewerId)) {
          throw new ApiError("CHAT_ACCESS_DENIED", "This conversation is not available to you.", 403);
        }

        const otherProfileId = conversation.participant_low === viewerId
          ? conversation.participant_high
          : conversation.participant_low;

        const [{ data: messages, error: messagesError }, { data: people }] = await Promise.all([
          admin
            .from("direct_messages")
            .select("id,conversation_id,sender_profile_id,body,reply_to_id,sent_at,edited_at,redacted_at")
            .eq("conversation_id", conversationId)
            .order("sent_at", { ascending: false })
            .limit(500),
          admin
            .from("profiles")
            .select("id,username,display_name,avatar_url,banner_url")
            .in("id", [viewerId, otherProfileId]),
        ]);

        if (messagesError) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t load these messages.", 500, undefined, false);
        const profileMap = new Map((people ?? []).map((profile: any) => [profile.id, profile]));
        return {
          data: {
            conversation: {
              ...conversation,
              other: publicProfile(profileMap.get(otherProfileId)),
            },
            messages: (messages ?? []).reverse().map((message: any) => ({
              ...message,
              sender: publicProfile(profileMap.get(message.sender_profile_id)),
            })),
          },
        };
      }

      const safety = await loadSafetyProfileSets(admin, viewerId);
      const { data: conversations, error: conversationError } = await admin
        .from("direct_conversations")
        .select("id,participant_low,participant_high,created_at,updated_at")
        .or(`participant_low.eq.${viewerId},participant_high.eq.${viewerId}`)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (conversationError) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t load your conversations.", 500, undefined, false);

      const rows = conversations ?? [];
      const otherIds = [...new Set(rows.map((conversation: any) =>
        conversation.participant_low === viewerId ? conversation.participant_high : conversation.participant_low
      ))];

      const [{ data: conversationProfiles }, { data: recentMessages }] = await Promise.all([
        otherIds.length
          ? admin.from("profiles").select("id,username,display_name,avatar_url,banner_url").in("id", otherIds)
          : Promise.resolve({ data: [] as any[] }),
        rows.length
          ? admin.from("direct_messages")
              .select("conversation_id,body,sent_at,sender_profile_id")
              .in("conversation_id", rows.map((row: any) => row.id))
              .order("sent_at", { ascending: false })
              .limit(1000)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map((conversationProfiles ?? []).map((profile: any) => [profile.id, profile]));
      const recentMap = new Map<string, any>();
      for (const message of recentMessages ?? []) {
        if (!recentMap.has(message.conversation_id)) recentMap.set(message.conversation_id, message);
      }

      const search = (url.searchParams.get("search") ?? "").trim().replace(/^@/, "").toLowerCase();
      const directoryQuery = () => admin.from("profiles")
        .select("id,username,display_name,avatar_url,banner_url")
        .neq("id", viewerId).not("username", "is", null).order("display_name").limit(search ? 100 : 40);
      // Escape pattern characters and search both indexed identities directly;
      // do not scan an arbitrary first 300 users to find a display name.
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      const results = search
        ? await Promise.all([
            directoryQuery().eq("username", search),
            directoryQuery().ilike("username", pattern),
            directoryQuery().ilike("display_name", pattern),
          ])
        : [await directoryQuery()];
      if (results.some((result) => result.error)) throw new ApiError("CHAT_DIRECTORY_FAILED", "We couldn’t load people right now.", 500, undefined, false);
      const matched = new Map<string, any>();
      for (const result of results) for (const profile of result.data ?? []) {
        if (!safety.blockedProfiles.has(profile.id)) matched.set(profile.id, profile);
      }
      const people = [...matched.values()].sort((a, b) =>
        Number(b.username === search) - Number(a.username === search) ||
        (a.display_name ?? a.username).localeCompare(b.display_name ?? b.username)
      ).slice(0, 100);

      return {
        data: {
          people: people.map(publicProfile),
          conversations: rows
            .map((conversation: any) => {
              const otherId = conversation.participant_low === viewerId
                ? conversation.participant_high
                : conversation.participant_low;
              if (safety.blockedProfiles.has(otherId)) return null;
              return {
                id: conversation.id,
                created_at: conversation.created_at,
                updated_at: conversation.updated_at,
                other: publicProfile(profileMap.get(otherId)),
                lastMessage: recentMap.get(conversation.id) ?? null,
              };
            })
            .filter(Boolean),
        },
      };
    }

    const body = assertObject(await jsonBody(request));
    const action = requiredString(body.action, "action", 40);

    if (action === "open_direct") {
      assertNoUnknownFields(body, ["action", "username"]);
      const username = normalizeUsername(body.username);
      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id,username,display_name,avatar_url,banner_url")
        .eq("username", username)
        .maybeSingle();

      if (targetError) throw new ApiError("CHAT_DIRECTORY_FAILED", "We couldn’t find that user right now.", 500, undefined, false);
      if (!target || target.id === viewerId) throw new ApiError("CHAT_USER_NOT_FOUND", "We couldn’t find that user.", 404);
      await assertProfilesMayInteract(admin, viewerId, target.id);

      const pair = pairFor(viewerId, target.id);
      let { data: conversation, error: lookupError } = await admin
        .from("direct_conversations")
        .select("id")
        .eq("participant_low", pair.participant_low)
        .eq("participant_high", pair.participant_high)
        .maybeSingle();

      if (lookupError) throw new ApiError("CHAT_CREATE_FAILED", "We couldn’t start this conversation.", 500, undefined, false);

      if (!conversation) {
        const created = await admin
          .from("direct_conversations")
          .insert({
            ...pair,
            created_by_profile_id: viewerId,
          })
          .select("id")
          .single();

        if (created.error?.code === "23505") {
          const retry = await admin
            .from("direct_conversations")
            .select("id")
            .eq("participant_low", pair.participant_low)
            .eq("participant_high", pair.participant_high)
            .single();
          if (retry.error) throw new ApiError("CHAT_CREATE_FAILED", "We couldn’t start this conversation.", 500, undefined, false);
          conversation = retry.data;
        } else if (created.error || !created.data) {
          throw new ApiError("CHAT_CREATE_FAILED", "We couldn’t start this conversation.", 500, undefined, false);
        } else {
          conversation = created.data;
        }
      }

      return {
        data: { conversationId: conversation.id, other: publicProfile(target) },
        status: 201,
      };
    }

    if (action === "send") {
      assertNoUnknownFields(body, ["action", "conversationId", "body", "replyToId"]);
      const conversationId = uuid(requiredString(body.conversationId, "conversationId", 36), "conversationId", true)!;
      const messageBody = requiredString(body.body, "body", 4000).trim();
      const replyToId = body.replyToId
        ? uuid(String(body.replyToId), "replyToId", true)
        : null;

      const { data: conversation, error: conversationError } = await admin
        .from("direct_conversations")
        .select("id,participant_low,participant_high")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversationError) throw new ApiError("CHAT_SEND_FAILED", "We couldn’t send this message.", 500, undefined, false);
      if (!conversation || ![conversation.participant_low, conversation.participant_high].includes(viewerId)) {
        throw new ApiError("CHAT_ACCESS_DENIED", "This conversation is not available to you.", 403);
      }

      const otherProfileId = conversation.participant_low === viewerId
        ? conversation.participant_high
        : conversation.participant_low;
      await assertProfilesMayInteract(admin, viewerId, otherProfileId);

      if (replyToId) {
        const { data: replyTarget } = await admin
          .from("direct_messages")
          .select("id")
          .eq("id", replyToId)
          .eq("conversation_id", conversationId)
          .maybeSingle();
        if (!replyTarget) throw new ApiError("INVALID_REPLY_TARGET", "That message is not in this conversation.", 422);
      }

      const { data: created, error: sendError } = await admin
        .from("direct_messages")
        .insert({
          conversation_id: conversationId,
          sender_profile_id: viewerId,
          body: messageBody,
          reply_to_id: replyToId,
        })
        .select("id,conversation_id,sender_profile_id,body,reply_to_id,sent_at,edited_at,redacted_at")
        .single();

      if (sendError || !created) throw new ApiError("CHAT_SEND_FAILED", "We couldn’t send this message.", 500, undefined, false);
      await admin
        .from("direct_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      const { data: sender } = await admin
        .from("profiles")
        .select("id,username,display_name,avatar_url,banner_url")
        .eq("id", viewerId)
        .single();

      return {
        data: { ...created, sender: publicProfile(sender) },
        status: 201,
      };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported chat action.", 422);
  },
));
