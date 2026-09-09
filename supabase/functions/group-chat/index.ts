import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { filterByAuthor, loadSafetyProfileSets } from "../_shared/safety.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.user || !auth.organizationId || !auth.membershipId) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Active church membership is required for group chat.", 401);
    }

    const admin = adminClient();
    const url = new URL(request.url);
    const body = request.method === "POST" ? assertObject(await jsonBody(request)) : {};
    const groupId = uuid(
      request.method === "GET" ? url.searchParams.get("groupId") : String(body.groupId ?? ""),
      "groupId",
      true,
    )!;

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("id,organization_id,branch_id,name,is_active")
      .eq("id", groupId)
      .eq("organization_id", auth.organizationId)
      .eq("is_active", true)
      .maybeSingle();

    if (groupError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load this group chat.", 500, undefined, false);
    if (!group) throw new ApiError("GROUP_NOT_FOUND", "This group is unavailable.", 404);
    if (auth.branchId && group.branch_id !== auth.branchId) {
      throw new ApiError("EXPRESSION_SCOPE_DENIED", "This group belongs to another Expression.", 403);
    }

    const { data: membership, error: membershipError } = await admin
      .from("group_memberships")
      .select("id,status,is_leader")
      .eq("group_id", groupId)
      .eq("organization_id", auth.organizationId)
      .eq("membership_id", auth.membershipId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to verify group membership.", 500, undefined, false);
    if (!membership) throw new ApiError("GROUP_CHAT_MEMBERSHIP_REQUIRED", "Join this group before opening its chat.", 403);

    if (request.method === "GET") {
      const { data: messages, error: messagesError } = await admin
        .from("group_messages")
        .select("id,group_id,sender_profile_id,body,reply_to_id,sent_at,edited_at,redacted_at")
        .eq("group_id", groupId)
        .order("sent_at", { ascending: true })
        .limit(500);
      if (messagesError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load group messages.", 500, undefined, false);

      const safety = await loadSafetyProfileSets(admin, auth.user.id);
      const visible = filterByAuthor(
        messages ?? [],
        safety.hiddenFromFeed,
        (message: any) => message.sender_profile_id,
      );
      const profileIds = [...new Set(visible.map((message: any) => message.sender_profile_id).filter(Boolean))];
      const { data: profiles } = profileIds.length
        ? await admin
            .from("profiles")
            .select("id,username,display_name,avatar_url")
            .in("id", profileIds)
        : { data: [] as any[] };
      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

      return {
        data: {
          group: {
            id: group.id,
            name: group.name,
            branch_id: group.branch_id,
            isLeader: membership.is_leader,
          },
          messages: visible.map((message: any) => ({
            ...message,
            sender: profileMap.get(message.sender_profile_id) ?? null,
          })),
        },
      };
    }

    assertNoUnknownFields(body, ["action", "groupId", "body", "replyToId"]);
    const action = requiredString(body.action, "action", 40);
    if (action !== "send") throw new ApiError("VALIDATION_FAILED", "Unsupported group chat action.", 422);

    const messageBody = requiredString(body.body, "body", 4000).trim();
    const replyToId = body.replyToId ? uuid(String(body.replyToId), "replyToId", true) : null;
    if (replyToId) {
      const { data: reply } = await admin
        .from("group_messages")
        .select("id")
        .eq("id", replyToId)
        .eq("group_id", groupId)
        .maybeSingle();
      if (!reply) throw new ApiError("INVALID_REPLY_TARGET", "That message is not in this group chat.", 422);
    }

    const { data: created, error: sendError } = await admin
      .from("group_messages")
      .insert({
        group_id: groupId,
        organization_id: auth.organizationId,
        sender_profile_id: auth.user.id,
        body: messageBody,
        reply_to_id: replyToId,
      })
      .select("id,group_id,sender_profile_id,body,reply_to_id,sent_at,edited_at,redacted_at")
      .single();

    if (sendError || !created) throw new ApiError("GROUP_CHAT_SEND_FAILED", "Unable to send this group message.", 500, undefined, false);
    const { data: sender } = await admin
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .eq("id", auth.user.id)
      .single();

    return {
      data: { ...created, sender },
      status: 201,
    };
  },
));
