import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status, headers: cors });
}

function failure(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: cors });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function uuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

async function authContext(request: Request, organizationId: string, branchId: string | null) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: failure("AUTHENTICATION_REQUIRED", "Please sign in to use chat.", 401) } as const;

  const url = requiredEnv("SUPABASE_URL");
  const anon = requiredEnv("SUPABASE_ANON_KEY");
  const service = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return { error: failure("INVALID_SESSION", "Please sign in again to continue.", 401) } as const;

  const { data: membership } = await admin.from("memberships")
    .select("id,profile_id")
    .eq("organization_id", organizationId)
    .eq("profile_id", userData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: failure("CHAT_MEMBERSHIP_REQUIRED", "Join this church community before using chat.", 403) } as const;

  if (branchId) {
    const { data: expressionMembership } = await admin.from("expression_memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("profile_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!expressionMembership) return { error: failure("EXPRESSION_MEMBERSHIP_REQUIRED", "Join this Expression before using its chat.", 403) } as const;
  }

  return { admin, user: userData.user, membership } as const;
}

async function spacePeople(admin: any, organizationId: string, branchId: string | null, viewerId: string) {
  let profileIds: string[] = [];
  if (branchId) {
    const { data } = await admin.from("expression_memberships")
      .select("profile_id")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .limit(500);
    profileIds = (data ?? []).map((row: any) => row.profile_id);
  } else {
    const { data } = await admin.from("memberships")
      .select("profile_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(500);
    profileIds = [...new Set((data ?? []).map((row: any) => row.profile_id))] as string[];
  }
  if (!profileIds.length) return [];
  const { data } = await admin.from("profiles")
    .select("id,username,display_name,avatar_url")
    .in("id", profileIds)
    .neq("id", viewerId)
    .not("username", "is", null)
    .order("display_name")
    .limit(300);
  return data ?? [];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!["GET", "POST"].includes(request.method)) return failure("METHOD_NOT_ALLOWED", "Method not allowed", 405);

  try {
    const url = new URL(request.url);
    let body: Record<string, unknown> = {};
    if (request.method === "POST") body = await request.json();
    const organizationId = uuid(request.method === "GET" ? url.searchParams.get("organizationId") : body.organizationId);
    const branchId = uuid(request.method === "GET" ? url.searchParams.get("branchId") : body.branchId);
    if (!organizationId) return failure("ORGANIZATION_REQUIRED", "Choose a church community to use chat.", 422);

    const context = await authContext(request, organizationId, branchId);
    if ("error" in context) return context.error;
    const { admin, user, membership } = context;

    if (request.method === "GET") {
      const conversationId = uuid(url.searchParams.get("conversationId"));
      if (conversationId) {
        const { data: participant } = await admin.from("conversation_participants")
          .select("conversation_id")
          .eq("conversation_id", conversationId)
          .eq("membership_id", membership.id)
          .is("left_at", null)
          .maybeSingle();
        if (!participant) return failure("CHAT_ACCESS_DENIED", "This conversation is not available to you.", 403);

        const { data: messages, error } = await admin.from("messages")
          .select("id,body,status,reply_to_id,sent_at,edited_at,sender_membership_id")
          .eq("conversation_id", conversationId)
          .order("sent_at", { ascending: true })
          .limit(250);
        if (error) return failure("CHAT_LOAD_FAILED", "We couldn’t load these messages.", 500);
        const senderIds = [...new Set((messages ?? []).map((item: any) => item.sender_membership_id))];
        const { data: senders } = senderIds.length ? await admin.from("memberships").select("id,profile_id").in("id", senderIds) : { data: [] };
        const profileIds = [...new Set((senders ?? []).map((item: any) => item.profile_id))];
        const { data: profiles } = profileIds.length ? await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", profileIds) : { data: [] };
        const senderMap = new Map((senders ?? []).map((item: any) => [item.id, item.profile_id]));
        const profileMap = new Map((profiles ?? []).map((item: any) => [item.id, item]));
        return response({
          messages: (messages ?? []).map((item: any) => ({ ...item, sender: profileMap.get(senderMap.get(item.sender_membership_id)) ?? null })),
        });
      }

      const people = await spacePeople(admin, organizationId, branchId, user.id);
      const { data: ownLinks } = await admin.from("conversation_participants")
        .select("conversation_id")
        .eq("membership_id", membership.id)
        .is("left_at", null);
      const ids = (ownLinks ?? []).map((row: any) => row.conversation_id);
      let conversations: any[] = [];
      if (ids.length) {
        const { data } = await admin.from("conversations")
          .select("id,branch_id,type,title,created_at,updated_at")
          .in("id", ids)
          .eq("organization_id", organizationId)
          .eq("type", "direct")
          .order("updated_at", { ascending: false });
        conversations = (data ?? []).filter((row: any) => branchId ? row.branch_id === branchId : row.branch_id === null);
      }
      const conversationIds = conversations.map((row: any) => row.id);
      const { data: links } = conversationIds.length ? await admin.from("conversation_participants").select("conversation_id,membership_id").in("conversation_id", conversationIds).is("left_at", null) : { data: [] };
      const memberIds = [...new Set((links ?? []).map((row: any) => row.membership_id))];
      const { data: members } = memberIds.length ? await admin.from("memberships").select("id,profile_id").in("id", memberIds) : { data: [] };
      const pids = [...new Set((members ?? []).map((row: any) => row.profile_id))];
      const { data: profiles } = pids.length ? await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", pids) : { data: [] };
      const memberProfile = new Map((members ?? []).map((row: any) => [row.id, row.profile_id]));
      const profileMap = new Map((profiles ?? []).map((row: any) => [row.id, row]));
      const { data: recentMessages } = conversationIds.length ? await admin.from("messages").select("conversation_id,body,sent_at").in("conversation_id", conversationIds).order("sent_at", { ascending: false }).limit(500) : { data: [] };
      const recentMap = new Map<string, any>();
      for (const item of recentMessages ?? []) if (!recentMap.has(item.conversation_id)) recentMap.set(item.conversation_id, item);

      return response({
        people,
        conversations: conversations.map((conversation: any) => {
          const otherLink = (links ?? []).find((link: any) => link.conversation_id === conversation.id && link.membership_id !== membership.id);
          const other = otherLink ? profileMap.get(memberProfile.get(otherLink.membership_id)) ?? null : null;
          return { ...conversation, other, lastMessage: recentMap.get(conversation.id) ?? null };
        }),
      });
    }

    const action = String(body.action ?? "");
    if (action === "open_direct") {
      const username = String(body.username ?? "").trim().replace(/^@/, "").toLowerCase();
      if (!username || username.length > 80) return failure("VALIDATION_FAILED", "Enter a valid username.", 422);
      const { data: target } = await admin.from("profiles").select("id,username,display_name,avatar_url").ilike("username", username).maybeSingle();
      if (!target || target.id === user.id) return failure("CHAT_USER_NOT_FOUND", "We couldn’t find that user in this space.", 404);
      const people = await spacePeople(admin, organizationId, branchId, user.id);
      if (!people.some((person: any) => person.id === target.id)) return failure("CHAT_USER_NOT_IN_SPACE", "That user is not in this space.", 403);
      const { data: targetMembership } = await admin.from("memberships").select("id").eq("organization_id", organizationId).eq("profile_id", target.id).eq("status", "active").order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!targetMembership) return failure("CHAT_USER_NOT_FOUND", "We couldn’t find that user in this space.", 404);

      const { data: ownLinks } = await admin.from("conversation_participants").select("conversation_id").eq("membership_id", membership.id).is("left_at", null);
      const ownIds = (ownLinks ?? []).map((row: any) => row.conversation_id);
      if (ownIds.length) {
        const { data: targetLinks } = await admin.from("conversation_participants").select("conversation_id").eq("membership_id", targetMembership.id).in("conversation_id", ownIds).is("left_at", null);
        const sharedIds = (targetLinks ?? []).map((row: any) => row.conversation_id);
        if (sharedIds.length) {
          const { data: existing } = await admin.from("conversations").select("id,branch_id,type").in("id", sharedIds).eq("organization_id", organizationId).eq("type", "direct");
          const found = (existing ?? []).find((row: any) => branchId ? row.branch_id === branchId : row.branch_id === null);
          if (found) return response({ conversationId: found.id, other: target });
        }
      }

      const { data: conversation, error: createError } = await admin.from("conversations").insert({ organization_id: organizationId, branch_id: branchId, type: "direct", created_by: user.id }).select("id").single();
      if (createError || !conversation) return failure("CHAT_CREATE_FAILED", "We couldn’t start this conversation.", 500);
      const { error: participantError } = await admin.from("conversation_participants").insert([
        { conversation_id: conversation.id, organization_id: organizationId, membership_id: membership.id },
        { conversation_id: conversation.id, organization_id: organizationId, membership_id: targetMembership.id },
      ]);
      if (participantError) return failure("CHAT_CREATE_FAILED", "We couldn’t start this conversation.", 500);
      return response({ conversationId: conversation.id, other: target }, 201);
    }

    if (action === "send") {
      const conversationId = uuid(body.conversationId);
      const messageBody = String(body.body ?? "").trim();
      if (!conversationId || !messageBody || messageBody.length > 4000) return failure("VALIDATION_FAILED", "Enter a message up to 4,000 characters.", 422);
      const { data: participant } = await admin.from("conversation_participants").select("conversation_id").eq("conversation_id", conversationId).eq("membership_id", membership.id).is("left_at", null).maybeSingle();
      if (!participant) return failure("CHAT_ACCESS_DENIED", "This conversation is not available to you.", 403);
      const { data: created, error } = await admin.from("messages").insert({ organization_id: organizationId, conversation_id: conversationId, sender_membership_id: membership.id, body: messageBody, status: "sent" }).select("id,body,status,sent_at,sender_membership_id").single();
      if (error || !created) return failure("CHAT_SEND_FAILED", "We couldn’t send this message.", 500);
      await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
      return response({ ...created, sender: { id: user.id } }, 201);
    }

    return failure("VALIDATION_FAILED", "Unsupported chat action.", 422);
  } catch (error) {
    console.error("chat function failed", error);
    return failure("CHAT_FAILED", "Chat is temporarily unavailable. Please try again.", 500);
  }
});
