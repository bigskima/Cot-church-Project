import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { resolveSecretJson } from "../_shared/secrets.ts";
import { commonOrganizationId, createNotifications, senderIdentity } from "../_shared/notifications.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertProfilesMayInteract } from "../_shared/safety.ts";
import { assertObject, requiredString, uuid } from "../_shared/validation.ts";
import { RtcRole, RtcTokenBuilder } from "npm:agora-token@2.0.6";

type CallScope = "direct" | "expression" | "group";
type CallKind = "audio" | "video";
type ScopeInput = {
  scope: CallScope;
  conversationId?: string | null;
  expressionId?: string | null;
  groupId?: string | null;
  sectionId?: string | null;
};

function optionalUuid(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") return null;
  return uuid(String(value), name, true)!;
}

function scopeValue(value: unknown): CallScope {
  const scope = requiredString(value, "scope", 20) as CallScope;
  if (!["direct", "expression", "group"].includes(scope)) {
    throw new ApiError("VALIDATION_FAILED", "Unknown call scope.", 422);
  }
  return scope;
}

function kindValue(value: unknown): CallKind {
  const kind = requiredString(value ?? "video", "callKind", 10) as CallKind;
  if (kind !== "audio" && kind !== "video") {
    throw new ApiError("VALIDATION_FAILED", "Call type must be audio or video.", 422);
  }
  return kind;
}

function scopeFrom(input: Record<string, unknown>): ScopeInput {
  return {
    scope: scopeValue(input.scope),
    conversationId: optionalUuid(input.conversationId, "conversationId"),
    expressionId: optionalUuid(input.expressionId, "expressionId"),
    groupId: optionalUuid(input.groupId, "groupId"),
    sectionId: optionalUuid(input.sectionId, "sectionId"),
  };
}

async function directAccess(admin: any, viewerId: string, conversationId: string | null | undefined) {
  if (!conversationId) throw new ApiError("VALIDATION_FAILED", "conversationId is required.", 422);
  const { data, error } = await admin.from("direct_conversations")
    .select("id,participant_low,participant_high")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data || ![data.participant_low, data.participant_high].includes(viewerId)) {
    throw new ApiError("CALL_ACCESS_DENIED", "This conversation is not available to you.", 403);
  }
  const otherProfileId = data.participant_low === viewerId ? data.participant_high : data.participant_low;
  await assertProfilesMayInteract(admin, viewerId, otherProfileId);
  return { organizationId: null, otherProfileId, branchId: null };
}

async function expressionAccess(admin: any, viewerId: string, expressionId: string | null | undefined) {
  if (!expressionId) throw new ApiError("VALIDATION_FAILED", "expressionId is required.", 422);
  const { data: membership, error } = await admin.from("expression_memberships")
    .select("organization_id,branch_id,status,chat_banned_at")
    .eq("branch_id", expressionId)
    .eq("profile_id", viewerId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !membership || membership.chat_banned_at) {
    throw new ApiError("CALL_ACCESS_DENIED", "Join this Expression to use its call.", 403);
  }
  return { organizationId: membership.organization_id as string, otherProfileId: null, branchId: expressionId };
}

async function groupAccess(admin: any, viewerId: string, groupId: string | null | undefined, sectionId: string | null | undefined) {
  if (!groupId) throw new ApiError("VALIDATION_FAILED", "groupId is required.", 422);
  const { data: group, error: groupError } = await admin.from("groups")
    .select("id,organization_id,branch_id,is_active")
    .eq("id", groupId)
    .eq("is_active", true)
    .maybeSingle();
  if (groupError || !group) throw new ApiError("GROUP_NOT_FOUND", "This Group is unavailable.", 404);

  const { data: membership, error: membershipError } = await admin.from("memberships")
    .select("id")
    .eq("organization_id", group.organization_id)
    .eq("profile_id", viewerId)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership) throw new ApiError("CALL_ACCESS_DENIED", "Join this Group to use its call.", 403);

  const { data: groupMembership, error: gmError } = await admin.from("group_memberships")
    .select("id,status,banned_at")
    .eq("group_id", groupId)
    .eq("organization_id", group.organization_id)
    .eq("membership_id", membership.id)
    .eq("status", "active")
    .maybeSingle();
  if (gmError || !groupMembership || groupMembership.banned_at) {
    throw new ApiError("CALL_ACCESS_DENIED", "Join this Group to use its call.", 403);
  }

  if (sectionId) {
    const { data: section, error: sectionError } = await admin.from("group_chat_sections")
      .select("id,is_archived,expires_at")
      .eq("id", sectionId)
      .eq("group_id", groupId)
      .eq("organization_id", group.organization_id)
      .maybeSingle();
    if (sectionError || !section || section.is_archived || (section.expires_at && new Date(section.expires_at) <= new Date())) {
      throw new ApiError("GROUP_SECTION_NOT_FOUND", "This temporary chat is no longer available.", 404);
    }
    const { data: sectionMember, error: smError } = await admin.from("group_chat_section_members")
      .select("id")
      .eq("section_id", sectionId)
      .eq("group_membership_id", groupMembership.id)
      .maybeSingle();
    if (smError || !sectionMember) {
      throw new ApiError("CALL_ACCESS_DENIED", "You have not been added to this temporary chat.", 403);
    }
  }

  return { organizationId: group.organization_id as string, otherProfileId: null, branchId: group.branch_id as string | null };
}

async function authorizeScope(admin: any, viewerId: string, input: ScopeInput) {
  if (input.scope === "direct") return directAccess(admin, viewerId, input.conversationId);
  if (input.scope === "expression") return expressionAccess(admin, viewerId, input.expressionId);
  return groupAccess(admin, viewerId, input.groupId, input.sectionId);
}

function applyScopeQuery(query: any, input: ScopeInput) {
  if (input.scope === "direct") return query.eq("scope", "direct").eq("conversation_id", input.conversationId);
  if (input.scope === "expression") return query.eq("scope", "expression").eq("expression_id", input.expressionId);
  query = query.eq("scope", "group").eq("group_id", input.groupId);
  return input.sectionId ? query.eq("section_id", input.sectionId) : query.is("section_id", null);
}

async function callRecipients(admin: any, input: ScopeInput, viewerId: string, otherProfileId?: string | null) {
  if (input.scope === "direct") return otherProfileId ? [otherProfileId] : [];
  if (input.scope === "expression") {
    const { data } = await admin.from("expression_memberships")
      .select("profile_id")
      .eq("branch_id", input.expressionId)
      .eq("status", "active")
      .is("chat_banned_at", null)
      .neq("profile_id", viewerId)
      .limit(250);
    return (data ?? []).map((row: any) => row.profile_id);
  }
  if (!input.groupId) return [];
  const { data: gm } = await admin.from("group_memberships")
    .select("id,membership_id")
    .eq("group_id", input.groupId)
    .eq("status", "active")
    .is("banned_at", null)
    .limit(500);
  let memberships = gm ?? [];
  if (input.sectionId && memberships.length) {
    const { data: allowed } = await admin.from("group_chat_section_members")
      .select("group_membership_id")
      .eq("section_id", input.sectionId)
      .in("group_membership_id", memberships.map((row: any) => row.id));
    const allowedIds = new Set((allowed ?? []).map((row: any) => row.group_membership_id));
    memberships = memberships.filter((row: any) => allowedIds.has(row.id));
  }
  if (!memberships.length) return [];
  const { data: members } = await admin.from("memberships")
    .select("id,profile_id")
    .in("id", memberships.map((row: any) => row.membership_id))
    .eq("status", "active");
  return (members ?? []).map((row: any) => row.profile_id).filter((id: string) => id !== viewerId);
}

async function expireStaleRingingCalls(admin: any) {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: stale } = await admin.from("chat_call_sessions")
    .select("id")
    .eq("status", "ringing")
    .lt("created_at", cutoff)
    .limit(100);
  const ids = (stale ?? []).map((row: any) => row.id);
  if (!ids.length) return;
  const now = new Date().toISOString();
  await Promise.all([
    admin.from("chat_call_sessions")
      .update({ status: "cancelled", ended_at: now })
      .in("id", ids)
      .eq("status", "ringing"),
    admin.from("chat_call_participants")
      .update({ state: "missed", left_at: now })
      .in("call_id", ids)
      .eq("state", "invited"),
  ]);
}

async function incomingCall(admin: any, viewerId: string) {
  const { data: invited, error } = await admin.from("chat_call_participants")
    .select("call_id,state,invited_at")
    .eq("profile_id", viewerId)
    .eq("state", "invited")
    .order("invited_at", { ascending: false })
    .limit(12);
  if (error) throw new ApiError("CALL_LOAD_FAILED", "Unable to load incoming calls.", 500, undefined, false);

  for (const row of invited ?? []) {
    const { data: call } = await admin.from("chat_call_sessions")
      .select("*")
      .eq("id", row.call_id)
      .in("status", ["ringing", "active"])
      .maybeSingle();
    if (!call) continue;
    try {
      await authorizeScope(admin, viewerId, {
        scope: call.scope,
        conversationId: call.conversation_id,
        expressionId: call.expression_id,
        groupId: call.group_id,
        sectionId: call.section_id,
      });
      return call;
    } catch {
      // Ignore stale invitations that no longer match the viewer's access.
    }
  }
  return null;
}

async function activeCall(admin: any, input: ScopeInput) {
  let query = admin.from("chat_call_sessions")
    .select("*")
    .in("status", ["ringing", "active"])
    .order("created_at", { ascending: false })
    .limit(1);
  query = applyScopeQuery(query, input);
  const { data, error } = await query.maybeSingle();
  if (error) throw new ApiError("CALL_LOAD_FAILED", "Unable to load this call.", 500, undefined, false);
  return data ?? null;
}

async function requireCall(admin: any, viewerId: string, callId: string) {
  const { data: call, error } = await admin.from("chat_call_sessions").select("*").eq("id", callId).maybeSingle();
  if (error || !call) throw new ApiError("CALL_NOT_FOUND", "This call is unavailable.", 404);
  await authorizeScope(admin, viewerId, {
    scope: call.scope,
    conversationId: call.conversation_id,
    expressionId: call.expression_id,
    groupId: call.group_id,
    sectionId: call.section_id,
  });
  return call;
}

function randomUid() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return Math.max(1, values[0] >>> 0);
}

async function rtcGrant(channelName: string) {
  const credentials = await resolveSecretJson<{ appId?: string; appCertificate?: string }>("STREAMING_AGORA_PRIMARY");
  const appId = String(credentials.appId ?? "").trim();
  const appCertificate = String(credentials.appCertificate ?? "").trim();
  if (!/^[0-9a-fA-F]{32}$/.test(appId) || !/^[0-9a-fA-F]{32}$/.test(appCertificate)) {
    throw new ApiError("AGORA_CREDENTIALS_INVALID", "COT calling is not configured correctly.", 503, undefined, false);
  }
  const uid = randomUid();
  const ttl = 2 * 60 * 60;
  const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, RtcRole.PUBLISHER, ttl, ttl);
  return {
    provider: "agora",
    appId,
    channelName,
    token,
    uid,
    role: "publisher",
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
  };
}

async function participants(admin: any, callId: string) {
  const { data } = await admin.from("chat_call_participants")
    .select("call_id,profile_id,state,invited_at,joined_at,left_at")
    .eq("call_id", callId)
    .order("invited_at");
  const ids = [...new Set((data ?? []).map((row: any) => row.profile_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", ids)
    : { data: [] as any[] };
  const map = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  return (data ?? []).map((row: any) => ({ ...row, profile: map.get(row.profile_id) ?? null }));
}

export const chatCallsHandler = createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Sign in to use calls.", 401);
    const admin = adminClient();
    const viewerId = auth.user.id;
    const url = new URL(request.url);
    await expireStaleRingingCalls(admin);

    if (request.method === "GET") {
      if (url.searchParams.get("incoming") === "true") {
        const call = await incomingCall(admin, viewerId);
        return { data: call ? { call, participants: await participants(admin, call.id) } : null };
      }
      const callId = optionalUuid(url.searchParams.get("callId"), "callId");
      if (callId) {
        const call = await requireCall(admin, viewerId, callId);
        return { data: { call, participants: await participants(admin, call.id) } };
      }
      const input = scopeFrom({
        scope: url.searchParams.get("scope"),
        conversationId: url.searchParams.get("conversationId"),
        expressionId: url.searchParams.get("expressionId"),
        groupId: url.searchParams.get("groupId"),
        sectionId: url.searchParams.get("sectionId"),
      });
      await authorizeScope(admin, viewerId, input);
      const call = await activeCall(admin, input);
      return { data: call ? { call, participants: await participants(admin, call.id) } : null };
    }

    const body = assertObject(await jsonBody(request));
    const action = requiredString(body.action, "action", 20);

    if (action === "create") {
      const input = scopeFrom(body);
      const callKind = kindValue(body.callKind);
      const access = await authorizeScope(admin, viewerId, input);
      const existing = await activeCall(admin, input);
      if (existing) return { data: { call: existing, participants: await participants(admin, existing.id), existing: true } };

      const row = {
        scope: input.scope,
        organization_id: access.organizationId,
        expression_id: input.scope === "expression" ? input.expressionId : null,
        conversation_id: input.scope === "direct" ? input.conversationId : null,
        group_id: input.scope === "group" ? input.groupId : null,
        section_id: input.scope === "group" ? input.sectionId ?? null : null,
        created_by_profile_id: viewerId,
        call_kind: callKind,
        agora_channel_name: `cot_call_${crypto.randomUUID().replaceAll("-", "")}`,
        status: "ringing",
      };
      const { data: call, error } = await admin.from("chat_call_sessions").insert(row).select("*").single();
      if (error || !call) {
        const raced = await activeCall(admin, input);
        if (raced) return { data: { call: raced, participants: await participants(admin, raced.id), existing: true } };
        throw new ApiError("CALL_CREATE_FAILED", "Unable to start this call.", 500, undefined, false);
      }

      const recipientProfileIds = await callRecipients(admin, input, viewerId, access.otherProfileId);
      const participantRows = [
        { call_id: call.id, profile_id: viewerId, state: "joined", joined_at: new Date().toISOString() },
        ...recipientProfileIds.map((profileId) => ({
          call_id: call.id,
          profile_id: profileId,
          state: "invited",
          joined_at: null,
        })),
      ];
      await admin.from("chat_call_participants").upsert(participantRows, { onConflict: "call_id,profile_id" });

      const notificationOrganizationId = access.organizationId
        ?? (access.otherProfileId ? await commonOrganizationId(admin, viewerId, access.otherProfileId) : null);
      if (notificationOrganizationId && recipientProfileIds.length) {
        const sender = await senderIdentity(admin, viewerId);
        const senderName = sender.display_name || sender.username || "A COT member";
        await createNotifications(admin, {
          organizationId: notificationOrganizationId,
          recipientProfileIds,
          senderProfileId: viewerId,
          type: "chat_call_started",
          title: `${senderName} started a ${callKind} call`,
          body: input.scope === "direct" ? "Tap to join the call." : input.scope === "expression" ? "Join the Expression discussion call." : "Join the Group discussion call.",
          data: {
            scope: access.branchId ? "expression" : "general",
            branchId: access.branchId ?? null,
            entityType: "chat_call",
            entityId: call.id,
            callId: call.id,
            callKind,
            callerProfileId: viewerId,
            callerName: senderName,
            urgent: true,
            route: `/calls/${call.id}`,
          },
        });
      }
      return { data: { call, participants: await participants(admin, call.id), existing: false }, status: 201 };
    }

    const callId = uuid(requiredString(body.callId, "callId", 36), "callId", true)!;
    const call = await requireCall(admin, viewerId, callId);

    if (action === "join") {
      if (!["ringing", "active"].includes(call.status)) throw new ApiError("CALL_ENDED", "This call has ended.", 409);
      const now = new Date().toISOString();
      await admin.from("chat_call_participants").upsert({
        call_id: call.id, profile_id: viewerId, state: "joined", joined_at: now, left_at: null,
      }, { onConflict: "call_id,profile_id" });

      // A direct call stays in the ringing state while only the caller is in the
      // Agora channel. It becomes active only when the invited person answers.
      const directCallerWaiting = call.scope === "direct"
        && call.created_by_profile_id === viewerId
        && call.status === "ringing";
      const nextStatus = directCallerWaiting ? "ringing" : "active";
      const startedAt = nextStatus === "active" ? (call.started_at ?? now) : call.started_at;
      if (call.status !== nextStatus || (nextStatus === "active" && !call.started_at)) {
        await admin.from("chat_call_sessions")
          .update({ status: nextStatus, started_at: startedAt ?? null })
          .eq("id", call.id);
      }
      return {
        data: {
          call: { ...call, status: nextStatus, started_at: startedAt ?? null },
          grant: await rtcGrant(call.agora_channel_name),
          participants: await participants(admin, call.id),
        },
      };
    }

    if (action === "decline") {
      const now = new Date().toISOString();
      await admin.from("chat_call_participants").upsert({
        call_id: call.id, profile_id: viewerId, state: "declined", left_at: now,
      }, { onConflict: "call_id,profile_id" });
      if (call.scope === "direct" && call.created_by_profile_id !== viewerId) {
        await Promise.all([
          admin.from("chat_call_sessions").update({ status: "cancelled", ended_at: now }).eq("id", call.id),
          admin.from("chat_call_participants").update({ state: "left", left_at: now }).eq("call_id", call.id).eq("state", "joined"),
        ]);
      }
      return { data: { ok: true } };
    }

    if (action === "leave") {
      const now = new Date().toISOString();
      await admin.from("chat_call_participants").upsert({
        call_id: call.id, profile_id: viewerId, state: "left", left_at: now,
      }, { onConflict: "call_id,profile_id" });

      if (call.scope === "direct") {
        await Promise.all([
          admin.from("chat_call_sessions")
            .update({ status: call.status === "ringing" ? "cancelled" : "ended", ended_at: now })
            .eq("id", call.id),
          admin.from("chat_call_participants")
            .update({ state: "left", left_at: now })
            .eq("call_id", call.id)
            .eq("state", "joined"),
          admin.from("chat_call_participants")
            .update({ state: "missed", left_at: now })
            .eq("call_id", call.id)
            .eq("state", "invited"),
        ]);
        return { data: { ok: true } };
      }

      const { count } = await admin.from("chat_call_participants")
        .select("*", { count: "exact", head: true })
        .eq("call_id", call.id)
        .eq("state", "joined");
      if (!count) await admin.from("chat_call_sessions").update({ status: "ended", ended_at: now }).eq("id", call.id);
      return { data: { ok: true } };
    }

    if (action === "end") {
      if (call.created_by_profile_id !== viewerId) throw new ApiError("CALL_END_DENIED", "Only the person who started this call can end it for everyone.", 403);
      const now = new Date().toISOString();
      await Promise.all([
        admin.from("chat_call_sessions").update({ status: "ended", ended_at: now }).eq("id", call.id),
        admin.from("chat_call_participants").update({ state: "left", left_at: now }).eq("call_id", call.id).eq("state", "joined"),
      ]);
      return { data: { ok: true } };
    }

    throw new ApiError("VALIDATION_FAILED", "Unknown call action.", 422);
  },
);

if (import.meta.main) Deno.serve(chatCallsHandler);
