import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import {
  chatAttachmentIds,
  completeChatUpload,
  createChatUpload,
  deleteChatUpload,
  hydrateChatMessages,
  markChatUploadsAttached,
  validateChatUploads,
} from "../_shared/chat-media.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertProfilesMayInteract, loadSafetyProfileSets } from "../_shared/safety.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const MESSAGE_SELECT = "id,conversation_id,sender_profile_id,body,reply_to_id,attachment_ids,pinned_at,pinned_by_profile_id,sent_at,edited_at,redacted_at";

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

async function requireConversation(admin: any, conversationId: string, viewerId: string) {
  const { data: conversation, error } = await admin
    .from("direct_conversations")
    .select("id,participant_low,participant_high,created_at,updated_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t load this conversation.", 500, undefined, false);
  if (!conversation || ![conversation.participant_low, conversation.participant_high].includes(viewerId)) {
    throw new ApiError("CHAT_ACCESS_DENIED", "This conversation is not available to you.", 403);
  }
  return conversation;
}

function uploadId(value: unknown) {
  return uuid(requiredString(value, "uploadId", 36), "uploadId", true)!;
}

function emojiValue(value: unknown) {
  const emoji = requiredString(value, "emoji", 16).trim();
  if (!emoji || Array.from(emoji).length > 8) throw new ApiError("VALIDATION_FAILED", "Choose a valid emoji.", 422);
  return emoji;
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}.`, 422);
  }
  return value.trim();
}

async function assertConversationInteraction(admin: any, conversation: any, viewerId: string) {
  const otherProfileId = conversation.participant_low === viewerId
    ? conversation.participant_high
    : conversation.participant_low;
  await assertProfilesMayInteract(admin, viewerId, otherProfileId);
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
        const conversation = await requireConversation(admin, conversationId, viewerId);
        const otherProfileId = conversation.participant_low === viewerId
          ? conversation.participant_high
          : conversation.participant_low;

        const [{ data: messageRows, error: messagesError }, { data: people }] = await Promise.all([
          admin
            .from("direct_messages")
            .select(MESSAGE_SELECT)
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
        const messages = await hydrateChatMessages(
          admin,
          "direct_messages",
          "direct_message_reactions",
          (messageRows ?? []).reverse(),
          viewerId,
        );
        return {
          data: {
            conversation: {
              ...conversation,
              other: publicProfile(profileMap.get(otherProfileId)),
            },
            messages,
            pinnedMessages: messages.filter((message: any) => message.pinned_at),
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
              .select("conversation_id,body,attachment_ids,sent_at,sender_profile_id")
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
                lastMessage: recentMap.has(conversation.id)
                  ? {
                      ...recentMap.get(conversation.id),
                      body: recentMap.get(conversation.id).body || "Media attachment",
                    }
                  : null,
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

    if (action === "create_upload") {
      assertNoUnknownFields(body, ["action", "conversationId", "mimeType", "fileName", "sizeBytes", "durationSeconds"]);
      const conversationId = uuid(requiredString(body.conversationId, "conversationId", 36), "conversationId", true)!;
      const conversation = await requireConversation(admin, conversationId, viewerId);
      const otherProfileId = conversation.participant_low === viewerId
        ? conversation.participant_high
        : conversation.participant_low;
      await assertProfilesMayInteract(admin, viewerId, otherProfileId);
      return {
        data: await createChatUpload(admin, viewerId, { conversationId }, {
          mimeType: body.mimeType,
          fileName: body.fileName,
          sizeBytes: body.sizeBytes,
          durationSeconds: body.durationSeconds,
        }),
        status: 201,
      };
    }

    if (action === "complete_upload") {
      assertNoUnknownFields(body, ["action", "conversationId", "uploadId"]);
      const conversationId = uuid(requiredString(body.conversationId, "conversationId", 36), "conversationId", true)!;
      await requireConversation(admin, conversationId, viewerId);
      return { data: await completeChatUpload(admin, viewerId, uploadId(body.uploadId), { conversationId }) };
    }

    if (action === "delete_upload") {
      assertNoUnknownFields(body, ["action", "conversationId", "uploadId"]);
      const conversationId = uuid(requiredString(body.conversationId, "conversationId", 36), "conversationId", true)!;
      await requireConversation(admin, conversationId, viewerId);
      return { data: await deleteChatUpload(admin, viewerId, uploadId(body.uploadId), { conversationId }) };
    }

    if (action === "send") {
      assertNoUnknownFields(body, ["action", "conversationId", "body", "replyToId", "attachmentIds"]);
      const conversationId = uuid(requiredString(body.conversationId, "conversationId", 36), "conversationId", true)!;
      const messageBody = optionalText(body.body, "body", 4000);
      const attachmentIds = chatAttachmentIds(body.attachmentIds);
      if (!messageBody && !attachmentIds.length) {
        throw new ApiError("VALIDATION_FAILED", "Write a message or add an attachment.", 422);
      }
      const replyToId = body.replyToId
        ? uuid(String(body.replyToId), "replyToId", true)
        : null;

      const conversation = await requireConversation(admin, conversationId, viewerId);
      await assertConversationInteraction(admin, conversation, viewerId);
      await validateChatUploads(admin, viewerId, attachmentIds, { conversationId });

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
          attachment_ids: attachmentIds,
        })
        .select(MESSAGE_SELECT)
        .single();

      if (sendError || !created) throw new ApiError("CHAT_SEND_FAILED", "We couldn’t send this message.", 500, undefined, false);
      try {
        await markChatUploadsAttached(admin, attachmentIds);
      } catch (error) {
        await admin.from("direct_messages").delete().eq("id", created.id);
        throw error;
      }
      await admin
        .from("direct_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return {
        data: (await hydrateChatMessages(
          admin,
          "direct_messages",
          "direct_message_reactions",
          [created],
          viewerId,
        ))[0],
        status: 201,
      };
    }

    if (action === "react") {
      assertNoUnknownFields(body, ["action", "conversationId", "messageId", "emoji"]);
      const conversationId = uuid(requiredString(body.conversationId, "conversationId", 36), "conversationId", true)!;
      const messageId = uuid(requiredString(body.messageId, "messageId", 36), "messageId", true)!;
      const conversation = await requireConversation(admin, conversationId, viewerId);
      await assertConversationInteraction(admin, conversation, viewerId);
      const { data: message } = await admin.from("direct_messages")
        .select("id")
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (!message) throw new ApiError("MESSAGE_NOT_FOUND", "This message is unavailable.", 404);
      const emoji = emojiValue(body.emoji);
      const { data: existing, error: lookupError } = await admin.from("direct_message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("profile_id", viewerId)
        .eq("emoji", emoji)
        .maybeSingle();
      if (lookupError) throw new ApiError("CHAT_REACTION_FAILED", "We couldn’t update this reaction.", 500, undefined, false);
      if (existing) {
        const { error } = await admin.from("direct_message_reactions").delete().eq("id", existing.id);
        if (error) throw new ApiError("CHAT_REACTION_FAILED", "We couldn’t update this reaction.", 500, undefined, false);
        return { data: { messageId, emoji, reacted: false } };
      }
      const { error } = await admin.from("direct_message_reactions")
        .insert({ message_id: messageId, profile_id: viewerId, emoji });
      if (error && error.code !== "23505") {
        throw new ApiError("CHAT_REACTION_FAILED", "We couldn’t update this reaction.", 500, undefined, false);
      }
      return { data: { messageId, emoji, reacted: true } };
    }

    if (action === "pin") {
      assertNoUnknownFields(body, ["action", "conversationId", "messageId", "pinned"]);
      if (typeof body.pinned !== "boolean") {
        throw new ApiError("VALIDATION_FAILED", "pinned must be true or false.", 422);
      }
      const conversationId = uuid(requiredString(body.conversationId, "conversationId", 36), "conversationId", true)!;
      const messageId = uuid(requiredString(body.messageId, "messageId", 36), "messageId", true)!;
      const conversation = await requireConversation(admin, conversationId, viewerId);
      await assertConversationInteraction(admin, conversation, viewerId);
      const { data, error } = await admin.from("direct_messages").update({
        pinned_at: body.pinned ? new Date().toISOString() : null,
        pinned_by_profile_id: body.pinned ? viewerId : null,
      }).eq("id", messageId).eq("conversation_id", conversationId)
        .select("id,pinned_at,pinned_by_profile_id").maybeSingle();
      if (error || !data) throw new ApiError("MESSAGE_NOT_FOUND", "This message is unavailable.", 404);
      return { data };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported chat action.", 422);
  },
));
