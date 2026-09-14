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
import { filterByAuthor, loadSafetyProfileSets } from "../_shared/safety.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const MESSAGE_SELECT = "id,group_id,section_id,sender_profile_id,body,reply_to_id,attachment_ids,pinned_at,pinned_by_profile_id,sent_at,edited_at,redacted_at";
const GROUP_PERMISSIONS = new Set([
  "manage_members",
  "manage_chat",
  "manage_content",
  "pin_messages",
  "create_sections",
  "assign_roles",
]);

function optionalUuid(value: unknown, name: string) {
  return value ? uuid(String(value), name, true)! : null;
}

function uploadId(value: unknown) {
  return uuid(requiredString(value, "uploadId", 36), "uploadId", true)!;
}

function emojiValue(value: unknown) {
  const emoji = requiredString(value, "emoji", 16).trim();
  if (!emoji || Array.from(emoji).length > 8) {
    throw new ApiError("VALIDATION_FAILED", "Choose a valid emoji.", 422);
  }
  return emoji;
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}.`, 422);
  }
  return value.trim();
}

function dateValue(value: unknown, field: string) {
  const raw = requiredString(value, field, 64);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}.`, 422);
  }
  return parsed;
}

function booleanValue(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new ApiError("VALIDATION_FAILED", `${field} must be true or false.`, 422);
  }
  return value;
}

function uuidList(value: unknown, field: string, limit = 100) {
  if (!Array.isArray(value)) throw new ApiError("VALIDATION_FAILED", `${field} must be a list.`, 422);
  const values = [...new Set(value.map((item) => uuid(String(item), field, true)!))];
  if (values.length > limit) throw new ApiError("VALIDATION_FAILED", `${field} contains too many people.`, 422);
  return values;
}

function permissionList(value: unknown) {
  if (!Array.isArray(value)) throw new ApiError("VALIDATION_FAILED", "permissions must be a list.", 422);
  const values = [...new Set(value.map((item) => String(item)))];
  if (values.some((permission) => !GROUP_PERMISSIONS.has(permission))) {
    throw new ApiError("VALIDATION_FAILED", "One or more Group permissions are invalid.", 422);
  }
  return values;
}

function colorValue(value: unknown) {
  const color = requiredString(value ?? "#64748B", "color", 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) {
    throw new ApiError("VALIDATION_FAILED", "Use a six-digit hex role color.", 422);
  }
  return color;
}

function activeRestriction(membership: any) {
  if (!membership.chat_restricted_until) return null;
  const until = new Date(membership.chat_restricted_until);
  return until > new Date() ? until : null;
}

function assertMayChat(membership: any) {
  const until = activeRestriction(membership);
  if (until) {
    throw new ApiError(
      "GROUP_CHAT_RESTRICTED",
      `A Group administrator restricted your chat access until ${until.toISOString()}.`,
      403,
    );
  }
}

async function canManage(auth: any, groupId: string, permission: string) {
  const { data, error } = await auth.client.rpc("can_manage_group_space", {
    target_group_id: groupId,
    requested_permission: permission,
  });
  if (error) {
    throw new ApiError("GROUP_PERMISSION_CHECK_FAILED", "Unable to verify Group permissions.", 500, undefined, false);
  }
  return data === true;
}

async function requireSection(auth: any, admin: any, groupId: string, sectionId: string | null) {
  if (!sectionId) return null;
  const { data: section, error } = await admin.from("group_chat_sections")
    .select("id,group_id,name,description,expires_at,is_archived")
    .eq("id", sectionId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error || !section || section.is_archived || (section.expires_at && new Date(section.expires_at) <= new Date())) {
    throw new ApiError("GROUP_SECTION_NOT_FOUND", "This temporary chat is no longer available.", 404);
  }
  const { data: allowed, error: accessError } = await auth.client.rpc("can_read_group_chat_section", {
    target_section_id: sectionId,
  });
  if (accessError || allowed !== true) {
    throw new ApiError("GROUP_SECTION_ACCESS_DENIED", "You have not been added to this temporary chat.", 403);
  }
  return section;
}

async function requireMessage(admin: any, groupId: string, sectionId: string | null, messageId: string) {
  let query = admin.from("group_messages")
    .select("id")
    .eq("id", messageId)
    .eq("group_id", groupId);
  query = sectionId ? query.eq("section_id", sectionId) : query.is("section_id", null);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new ApiError("MESSAGE_NOT_FOUND", "This message is unavailable.", 404);
  return data;
}

async function groupMemberProfile(admin: any, groupId: string, organizationId: string, groupMembershipId: string) {
  const { data: target, error } = await admin.from("group_memberships")
    .select("id,membership_id,status,is_leader,banned_at")
    .eq("id", groupMembershipId)
    .eq("group_id", groupId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !target) throw new ApiError("GROUP_MEMBER_NOT_FOUND", "That Group member is unavailable.", 404);
  const { data: member, error: memberError } = await admin.from("memberships")
    .select("id,profile_id")
    .eq("id", target.membership_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (memberError || !member) throw new ApiError("GROUP_MEMBER_NOT_FOUND", "That Group member is unavailable.", 404);
  return { ...target, profileId: member.profile_id };
}

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.user || !auth.organizationId || !auth.membershipId) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Active church membership is required for Group chat.", 401);
    }

    const admin = adminClient();
    const url = new URL(request.url);
    const body = request.method === "POST" ? assertObject(await jsonBody(request)) : {};
    const groupId = uuid(
      request.method === "GET" ? url.searchParams.get("groupId") : String(body.groupId ?? ""),
      "groupId",
      true,
    )!;
    const sectionId = optionalUuid(
      request.method === "GET" ? url.searchParams.get("sectionId") : body.sectionId,
      "sectionId",
    );

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("id,organization_id,branch_id,name,description,visibility,join_policy,created_by,meeting_schedule,is_active")
      .eq("id", groupId)
      .eq("organization_id", auth.organizationId)
      .eq("is_active", true)
      .maybeSingle();

    if (groupError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load this Group.", 500, undefined, false);
    if (!group) throw new ApiError("GROUP_NOT_FOUND", "This Group is unavailable.", 404);
    if (auth.branchId && group.branch_id !== auth.branchId) {
      throw new ApiError("EXPRESSION_SCOPE_DENIED", "This Group belongs to another Expression.", 403);
    }

    const { data: membership, error: membershipError } = await admin
      .from("group_memberships")
      .select("id,status,is_leader,chat_restricted_until,banned_at,moderation_reason")
      .eq("group_id", groupId)
      .eq("organization_id", auth.organizationId)
      .eq("membership_id", auth.membershipId)
      .maybeSingle();

    if (membershipError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to verify Group membership.", 500, undefined, false);
    if (!membership || membership.status !== "active" || membership.banned_at) {
      throw new ApiError("GROUP_CHAT_MEMBERSHIP_REQUIRED", "Join this Group before opening its space.", 403);
    }

    const section = await requireSection(auth, admin, groupId, sectionId);

    if (request.method === "GET") {
      const [manageMembers, manageChat, manageContent, pinMessages, createSections, assignRoles] = await Promise.all([
        canManage(auth, groupId, "manage_members"),
        canManage(auth, groupId, "manage_chat"),
        canManage(auth, groupId, "manage_content"),
        canManage(auth, groupId, "pin_messages"),
        canManage(auth, groupId, "create_sections"),
        canManage(auth, groupId, "assign_roles"),
      ]);

      let messagesQuery = admin.from("group_messages")
        .select(MESSAGE_SELECT)
        .eq("group_id", groupId);
      messagesQuery = sectionId
        ? messagesQuery.eq("section_id", sectionId)
        : messagesQuery.is("section_id", null);
      messagesQuery = messagesQuery.order("sent_at", { ascending: false }).limit(500);

      let memberQuery = admin.from("group_memberships")
        .select("id,membership_id,status,is_leader,chat_restricted_until,banned_at,moderation_reason,requested_at,responded_at")
        .eq("group_id", groupId)
        .eq("organization_id", auth.organizationId)
        .order("requested_at", { ascending: true });
      if (!manageMembers) memberQuery = memberQuery.eq("status", "active").is("banned_at", null);

      const [
        { data: messageRows, error: messagesError },
        { data: memberRows, error: membersError },
        { data: sectionRows, error: sectionsError },
        { data: sectionMemberRows, error: sectionMembersError },
        { data: roleRows, error: rolesError },
        { data: roleAssignmentRows, error: assignmentsError },
        { data: announcementRows, error: announcementsError },
        { data: eventRows, error: eventsError },
        { data: givingRows, error: givingError },
      ] = await Promise.all([
        messagesQuery,
        memberQuery,
        auth.client.from("group_chat_sections")
          .select("id,group_id,name,description,created_by_profile_id,expires_at,is_archived,created_at")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        auth.client.from("group_chat_section_members")
          .select("id,section_id,group_membership_id,created_at")
          .eq("group_id", groupId),
        admin.from("group_roles")
          .select("id,name,color,permissions,is_system,created_at")
          .eq("group_id", groupId)
          .order("is_system", { ascending: false })
          .order("name"),
        admin.from("group_role_assignments")
          .select("id,group_role_id,group_membership_id,created_at")
          .eq("group_id", groupId),
        admin.from("group_announcements")
          .select("id,title,body,status,is_pinned,published_at,expires_at,created_by_profile_id,created_at,updated_at")
          .eq("group_id", groupId)
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false }),
        admin.from("group_events")
          .select("id,title,description,starts_at,ends_at,timezone,location,status,created_by_profile_id,created_at,updated_at")
          .eq("group_id", groupId)
          .order("starts_at", { ascending: true }),
        admin.from("group_giving_options")
          .select("id,giving_purpose_id,label,note,is_active,created_by_profile_id,created_at,updated_at")
          .eq("group_id", groupId)
          .order("created_at"),
      ]);

      if (messagesError || membersError || sectionsError || sectionMembersError || rolesError || assignmentsError || announcementsError || eventsError || givingError) {
        throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load this Group space.", 500, undefined, false);
      }

      const safety = await loadSafetyProfileSets(admin, auth.user.id);
      const visibleRows = filterByAuthor(
        (messageRows ?? []).reverse(),
        safety.hiddenFromFeed,
        (message: any) => message.sender_profile_id,
      );
      const messages = await hydrateChatMessages(
        admin,
        "group_messages",
        "group_message_reactions",
        visibleRows,
        auth.user.id,
        safety.hiddenFromFeed,
      );

      const membershipIds = [...new Set((memberRows ?? []).map((item: any) => item.membership_id))];
      const { data: organizationMembers, error: organizationMembersError } = membershipIds.length
        ? await admin.from("memberships")
          .select("id,profile_id,branch_id")
          .eq("organization_id", auth.organizationId)
          .in("id", membershipIds)
        : { data: [] as any[], error: null };
      if (organizationMembersError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load Group members.", 500, undefined, false);
      const profileIds = [...new Set((organizationMembers ?? []).map((item: any) => item.profile_id))];
      const { data: profiles, error: profilesError } = profileIds.length
        ? await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", profileIds)
        : { data: [] as any[], error: null };
      if (profilesError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load Group members.", 500, undefined, false);

      const organizationMemberMap = new Map((organizationMembers ?? []).map((item: any) => [item.id, item]));
      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
      const rolesByMembership = new Map<string, any[]>();
      const roleMap = new Map((roleRows ?? []).map((role: any) => [role.id, role]));
      for (const assignment of roleAssignmentRows ?? []) {
        const role = roleMap.get(assignment.group_role_id);
        if (!role) continue;
        rolesByMembership.set(assignment.group_membership_id, [
          ...(rolesByMembership.get(assignment.group_membership_id) ?? []),
          role,
        ]);
      }
      const members = (memberRows ?? []).map((item: any) => {
        const organizationMember = organizationMemberMap.get(item.membership_id);
        return {
          ...item,
          profile: organizationMember ? profileMap.get(organizationMember.profile_id) ?? null : null,
          roles: rolesByMembership.get(item.id) ?? [],
        };
      });

      const purposeIds = [...new Set((givingRows ?? []).map((item: any) => item.giving_purpose_id))];
      const { data: linkedPurposes, error: purposesError } = purposeIds.length
        ? await admin.from("giving_purposes")
          .select("id,branch_id,name,description,status")
          .eq("organization_id", auth.organizationId)
          .in("id", purposeIds)
        : { data: [] as any[], error: null };
      if (purposesError) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load Group giving options.", 500, undefined, false);
      const purposeMap = new Map((linkedPurposes ?? []).map((item: any) => [item.id, item]));

      let availableGivingPurposes: any[] = [];
      if (manageContent) {
        let purposeQuery = admin.from("giving_purposes")
          .select("id,branch_id,name,description,status")
          .eq("organization_id", auth.organizationId)
          .eq("status", "active")
          .order("display_order")
          .order("name");
        purposeQuery = group.branch_id
          ? purposeQuery.or(`branch_id.is.null,branch_id.eq.${group.branch_id}`)
          : purposeQuery.is("branch_id", null);
        const { data, error } = await purposeQuery;
        if (error) throw new ApiError("GROUP_CHAT_LOAD_FAILED", "Unable to load available giving destinations.", 500, undefined, false);
        availableGivingPurposes = data ?? [];
      }

      const now = Date.now();
      const announcements = (announcementRows ?? []).filter((item: any) => manageContent || (
        item.status === "published" &&
        item.published_at && new Date(item.published_at).getTime() <= now &&
        (!item.expires_at || new Date(item.expires_at).getTime() > now)
      ));
      const events = (eventRows ?? []).filter((item: any) => manageContent || item.status === "published");
      const giving = (givingRows ?? []).filter((item: any) => manageContent || item.is_active).map((item: any) => ({
        ...item,
        purpose: purposeMap.get(item.giving_purpose_id) ?? null,
      }));

      return {
        data: {
          group: {
            id: group.id,
            name: group.name,
            description: group.description,
            branch_id: group.branch_id,
            visibility: group.visibility,
            join_policy: group.join_policy,
            meeting_schedule: group.meeting_schedule,
            created_by: group.created_by,
            isLeader: membership.is_leader,
          },
          membership,
          permissions: { manageMembers, manageChat, manageContent, pinMessages, createSections, assignRoles },
          activeSection: section,
          messages,
          pinnedMessages: messages.filter((message: any) => message.pinned_at),
          sections: sectionRows ?? [],
          sectionMembers: sectionMemberRows ?? [],
          members,
          roles: roleRows ?? [],
          roleAssignments: roleAssignmentRows ?? [],
          announcements,
          events,
          givingOptions: giving,
          availableGivingPurposes,
        },
      };
    }

    const action = requiredString(body.action, "action", 40);

    if (action === "create_upload") {
      assertNoUnknownFields(body, ["action", "groupId", "sectionId", "mimeType", "fileName", "sizeBytes", "durationSeconds"]);
      assertMayChat(membership);
      return {
        data: await createChatUpload(admin, auth.user.id, {
          organizationId: auth.organizationId,
          groupId,
          sectionId,
        }, {
          mimeType: body.mimeType,
          fileName: body.fileName,
          sizeBytes: body.sizeBytes,
          durationSeconds: body.durationSeconds,
        }),
        status: 201,
      };
    }

    if (action === "complete_upload") {
      assertNoUnknownFields(body, ["action", "groupId", "sectionId", "uploadId"]);
      assertMayChat(membership);
      return {
        data: await completeChatUpload(admin, auth.user.id, uploadId(body.uploadId), {
          organizationId: auth.organizationId,
          groupId,
          sectionId,
        }),
      };
    }

    if (action === "delete_upload") {
      assertNoUnknownFields(body, ["action", "groupId", "sectionId", "uploadId"]);
      return {
        data: await deleteChatUpload(admin, auth.user.id, uploadId(body.uploadId), {
          organizationId: auth.organizationId,
          groupId,
          sectionId,
        }),
      };
    }

    if (action === "send") {
      assertNoUnknownFields(body, ["action", "groupId", "sectionId", "body", "replyToId", "attachmentIds"]);
      assertMayChat(membership);
      const messageBody = optionalText(body.body, "body", 4000);
      const attachmentIds = chatAttachmentIds(body.attachmentIds);
      if (!messageBody && !attachmentIds.length) {
        throw new ApiError("VALIDATION_FAILED", "Write a message or attach media.", 422);
      }
      const replyToId = optionalUuid(body.replyToId, "replyToId");
      await validateChatUploads(admin, auth.user.id, attachmentIds, {
        organizationId: auth.organizationId,
        groupId,
        sectionId,
      });
      if (replyToId) await requireMessage(admin, groupId, sectionId, replyToId);

      const { data: created, error: sendError } = await admin
        .from("group_messages")
        .insert({
          group_id: groupId,
          organization_id: auth.organizationId,
          section_id: sectionId,
          sender_profile_id: auth.user.id,
          body: messageBody,
          reply_to_id: replyToId,
          attachment_ids: attachmentIds,
        })
        .select(MESSAGE_SELECT)
        .single();
      if (sendError || !created) {
        throw new ApiError("GROUP_CHAT_SEND_FAILED", "Unable to send this Group message.", 500, undefined, false);
      }
      try {
        await markChatUploadsAttached(admin, attachmentIds);
      } catch (error) {
        await admin.from("group_messages").delete().eq("id", created.id);
        throw error;
      }

      return {
        data: (await hydrateChatMessages(
          admin,
          "group_messages",
          "group_message_reactions",
          [created],
          auth.user.id,
        ))[0],
        status: 201,
      };
    }

    if (action === "react") {
      assertNoUnknownFields(body, ["action", "groupId", "sectionId", "messageId", "emoji"]);
      assertMayChat(membership);
      const messageId = uuid(requiredString(body.messageId, "messageId", 36), "messageId", true)!;
      await requireMessage(admin, groupId, sectionId, messageId);
      const emoji = emojiValue(body.emoji);
      const { data: existing, error: lookupError } = await admin.from("group_message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("profile_id", auth.user.id)
        .eq("emoji", emoji)
        .maybeSingle();
      if (lookupError) throw new ApiError("CHAT_REACTION_FAILED", "Unable to update this reaction.", 500, undefined, false);
      if (existing) {
        const { error } = await admin.from("group_message_reactions").delete().eq("id", existing.id);
        if (error) throw new ApiError("CHAT_REACTION_FAILED", "Unable to update this reaction.", 500, undefined, false);
        return { data: { messageId, emoji, reacted: false } };
      }
      const { error } = await admin.from("group_message_reactions")
        .insert({ message_id: messageId, profile_id: auth.user.id, emoji });
      if (error && error.code !== "23505") {
        throw new ApiError("CHAT_REACTION_FAILED", "Unable to update this reaction.", 500, undefined, false);
      }
      return { data: { messageId, emoji, reacted: true } };
    }

    if (action === "pin") {
      assertNoUnknownFields(body, ["action", "groupId", "sectionId", "messageId", "pinned"]);
      if (!(await canManage(auth, groupId, "pin_messages"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot pin messages in this Group.", 403);
      }
      const messageId = uuid(requiredString(body.messageId, "messageId", 36), "messageId", true)!;
      await requireMessage(admin, groupId, sectionId, messageId);
      const pinned = booleanValue(body.pinned, "pinned");
      const { data, error } = await admin.from("group_messages").update({
        pinned_at: pinned ? new Date().toISOString() : null,
        pinned_by_profile_id: pinned ? auth.user.id : null,
      }).eq("id", messageId).select("id,pinned_at,pinned_by_profile_id").maybeSingle();
      if (error || !data) throw new ApiError("MESSAGE_NOT_FOUND", "This message is unavailable.", 404);
      return { data };
    }

    if (action === "create_section") {
      assertNoUnknownFields(body, ["action", "groupId", "name", "description", "expiresAt", "memberIds"]);
      if (!(await canManage(auth, groupId, "create_sections"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot create temporary chats in this Group.", 403);
      }
      const name = requiredString(body.name, "name", 80);
      const description = optionalText(body.description, "description", 1000);
      const expiresAt = body.expiresAt
        ? dateValue(body.expiresAt, "expiresAt")
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (expiresAt.getTime() <= Date.now() + 5 * 60 * 1000 || expiresAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
        throw new ApiError("VALIDATION_FAILED", "Temporary chats must expire between five minutes and 30 days from now.", 422);
      }
      const requestedMembers = uuidList(body.memberIds ?? [], "memberIds");
      const memberIds = [...new Set([...requestedMembers, membership.id])];
      const { data: validMembers, error: validMembersError } = await admin.from("group_memberships")
        .select("id")
        .eq("group_id", groupId)
        .eq("organization_id", auth.organizationId)
        .eq("status", "active")
        .is("banned_at", null)
        .in("id", memberIds);
      if (validMembersError || (validMembers ?? []).length !== memberIds.length) {
        throw new ApiError("INVALID_SECTION_MEMBERS", "One or more selected people are not active Group members.", 422);
      }
      const { data: created, error: createError } = await admin.from("group_chat_sections").insert({
        organization_id: auth.organizationId,
        group_id: groupId,
        name,
        description,
        created_by_profile_id: auth.user.id,
        expires_at: expiresAt.toISOString(),
      }).select("id,group_id,name,description,expires_at,is_archived,created_at").single();
      if (createError || !created) throw new ApiError("GROUP_SECTION_CREATE_FAILED", "Unable to create this temporary chat.", 500, undefined, false);
      const { error: memberInsertError } = await admin.from("group_chat_section_members").insert(
        memberIds.map((groupMembershipId) => ({
          organization_id: auth.organizationId,
          group_id: groupId,
          section_id: created.id,
          group_membership_id: groupMembershipId,
          added_by_profile_id: auth.user.id,
        })),
      );
      if (memberInsertError) {
        await admin.from("group_chat_sections").delete().eq("id", created.id);
        throw new ApiError("GROUP_SECTION_CREATE_FAILED", "Unable to add people to this temporary chat.", 500, undefined, false);
      }
      return { data: { ...created, memberIds }, status: 201 };
    }

    if (action === "archive_section") {
      assertNoUnknownFields(body, ["action", "groupId", "sectionId"]);
      if (!(await canManage(auth, groupId, "create_sections"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot close temporary chats in this Group.", 403);
      }
      const targetSectionId = uuid(requiredString(body.sectionId, "sectionId", 36), "sectionId", true)!;
      const { data, error } = await admin.from("group_chat_sections")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", targetSectionId)
        .eq("group_id", groupId)
        .select("id,is_archived")
        .maybeSingle();
      if (error || !data) throw new ApiError("GROUP_SECTION_NOT_FOUND", "This temporary chat is unavailable.", 404);
      return { data };
    }

    if (action === "restrict_member") {
      assertNoUnknownFields(body, ["action", "groupId", "groupMembershipId", "until", "reason"]);
      if (!(await canManage(auth, groupId, "manage_chat")) && !(await canManage(auth, groupId, "manage_members"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot restrict Group members.", 403);
      }
      const targetId = uuid(requiredString(body.groupMembershipId, "groupMembershipId", 36), "groupMembershipId", true)!;
      const target = await groupMemberProfile(admin, groupId, auth.organizationId, targetId);
      if (target.profileId === auth.user.id || target.profileId === group.created_by) {
        throw new ApiError("PROTECTED_GROUP_MEMBER", "The Group creator cannot be restricted.", 409);
      }
      if (target.is_leader && group.created_by !== auth.user.id) {
        throw new ApiError("PERMISSION_DENIED", "Only the Group creator can restrict another Group leader.", 403);
      }
      const until = body.until === null || body.until === "" ? null : dateValue(body.until, "until");
      if (until && (until.getTime() <= Date.now() || until.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000)) {
        throw new ApiError("VALIDATION_FAILED", "Restriction expiry must be within the next year.", 422);
      }
      const reason = optionalText(body.reason, "reason", 500) || null;
      const { data, error } = await admin.from("group_memberships").update({
        chat_restricted_until: until?.toISOString() ?? null,
        moderation_reason: until ? reason : null,
      }).eq("id", targetId).eq("group_id", groupId)
        .select("id,chat_restricted_until,moderation_reason").maybeSingle();
      if (error || !data) throw new ApiError("GROUP_MEMBER_NOT_FOUND", "That Group member is unavailable.", 404);
      return { data };
    }

    if (action === "ban_member" || action === "unban_member") {
      assertNoUnknownFields(body, ["action", "groupId", "groupMembershipId", "reason"]);
      if (!(await canManage(auth, groupId, "manage_members"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot remove Group members.", 403);
      }
      const targetId = uuid(requiredString(body.groupMembershipId, "groupMembershipId", 36), "groupMembershipId", true)!;
      const target = await groupMemberProfile(admin, groupId, auth.organizationId, targetId);
      if (target.profileId === auth.user.id || target.profileId === group.created_by) {
        throw new ApiError("PROTECTED_GROUP_MEMBER", "The Group creator cannot be removed.", 409);
      }
      if (target.is_leader && group.created_by !== auth.user.id) {
        throw new ApiError("PERMISSION_DENIED", "Only the Group creator can remove another Group leader.", 403);
      }
      const banning = action === "ban_member";
      const reason = optionalText(body.reason, "reason", 500) || null;
      const { data, error } = await admin.from("group_memberships").update({
        status: banning ? "removed" : "active",
        banned_at: banning ? new Date().toISOString() : null,
        banned_by_profile_id: banning ? auth.user.id : null,
        moderation_reason: banning ? reason : null,
        chat_restricted_until: null,
        responded_at: new Date().toISOString(),
      }).eq("id", targetId).eq("group_id", groupId)
        .select("id,status,banned_at,moderation_reason").maybeSingle();
      if (error || !data) throw new ApiError("GROUP_MEMBER_NOT_FOUND", "That Group member is unavailable.", 404);
      return { data };
    }

    if (action === "create_role") {
      assertNoUnknownFields(body, ["action", "groupId", "name", "color", "permissions"]);
      if (!(await canManage(auth, groupId, "assign_roles"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot create roles in this Group.", 403);
      }
      const { data, error } = await admin.from("group_roles").insert({
        organization_id: auth.organizationId,
        group_id: groupId,
        name: requiredString(body.name, "name", 50),
        color: colorValue(body.color),
        permissions: permissionList(body.permissions ?? []),
        is_system: false,
        created_by_profile_id: auth.user.id,
      }).select("id,name,color,permissions,is_system,created_at").single();
      if (error?.code === "23505") throw new ApiError("ROLE_EXISTS", "A role with this name already exists.", 409);
      if (error || !data) throw new ApiError("GROUP_ROLE_CREATE_FAILED", "Unable to create this Group role.", 500, undefined, false);
      return { data, status: 201 };
    }

    if (action === "assign_role") {
      assertNoUnknownFields(body, ["action", "groupId", "groupMembershipId", "roleId", "assigned"]);
      if (!(await canManage(auth, groupId, "assign_roles"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot assign roles in this Group.", 403);
      }
      const groupMembershipId = uuid(requiredString(body.groupMembershipId, "groupMembershipId", 36), "groupMembershipId", true)!;
      const roleId = uuid(requiredString(body.roleId, "roleId", 36), "roleId", true)!;
      const assigned = booleanValue(body.assigned, "assigned");
      const [target, roleResult] = await Promise.all([
        groupMemberProfile(admin, groupId, auth.organizationId, groupMembershipId),
        admin.from("group_roles").select("id").eq("id", roleId).eq("group_id", groupId).maybeSingle(),
      ]);
      if (target.status !== "active" || target.banned_at || roleResult.error || !roleResult.data) {
        throw new ApiError("GROUP_ROLE_TARGET_INVALID", "Choose an active member and a role from this Group.", 422);
      }
      if (!assigned) {
        const { error } = await admin.from("group_role_assignments").delete()
          .eq("group_role_id", roleId)
          .eq("group_membership_id", groupMembershipId);
        if (error) throw new ApiError("GROUP_ROLE_ASSIGN_FAILED", "Unable to update this member’s roles.", 500, undefined, false);
        return { data: { groupMembershipId, roleId, assigned: false } };
      }
      const { error } = await admin.from("group_role_assignments").upsert({
        organization_id: auth.organizationId,
        group_id: groupId,
        group_role_id: roleId,
        group_membership_id: groupMembershipId,
        assigned_by_profile_id: auth.user.id,
      }, { onConflict: "group_role_id,group_membership_id" });
      if (error) throw new ApiError("GROUP_ROLE_ASSIGN_FAILED", "Unable to update this member’s roles.", 500, undefined, false);
      return { data: { groupMembershipId, roleId, assigned: true } };
    }

    if (action === "create_announcement") {
      assertNoUnknownFields(body, ["action", "groupId", "title", "body", "isPinned", "expiresAt"]);
      if (!(await canManage(auth, groupId, "manage_content"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot publish Group announcements.", 403);
      }
      const expiresAt = body.expiresAt ? dateValue(body.expiresAt, "expiresAt") : null;
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        throw new ApiError("VALIDATION_FAILED", "Announcement expiry must be in the future.", 422);
      }
      const now = new Date().toISOString();
      const { data, error } = await admin.from("group_announcements").insert({
        organization_id: auth.organizationId,
        group_id: groupId,
        title: requiredString(body.title, "title", 180),
        body: requiredString(body.body, "body", 20000),
        status: "published",
        is_pinned: body.isPinned === undefined ? false : booleanValue(body.isPinned, "isPinned"),
        published_at: now,
        expires_at: expiresAt?.toISOString() ?? null,
        created_by_profile_id: auth.user.id,
      }).select("id,title,body,status,is_pinned,published_at,expires_at,created_at").single();
      if (error || !data) throw new ApiError("GROUP_ANNOUNCEMENT_CREATE_FAILED", "Unable to publish this announcement.", 500, undefined, false);
      return { data, status: 201 };
    }

    if (action === "create_event") {
      assertNoUnknownFields(body, ["action", "groupId", "title", "description", "startsAt", "endsAt", "timezone", "location"]);
      if (!(await canManage(auth, groupId, "manage_content"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot publish Group events.", 403);
      }
      const startsAt = dateValue(body.startsAt, "startsAt");
      const endsAt = body.endsAt ? dateValue(body.endsAt, "endsAt") : null;
      if (endsAt && endsAt <= startsAt) throw new ApiError("VALIDATION_FAILED", "Event end must be after its start.", 422);
      const location = optionalText(body.location, "location", 500);
      const { data, error } = await admin.from("group_events").insert({
        organization_id: auth.organizationId,
        group_id: groupId,
        title: requiredString(body.title, "title", 180),
        description: optionalText(body.description, "description", 20000),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt?.toISOString() ?? null,
        timezone: requiredString(body.timezone ?? "UTC", "timezone", 100),
        location: location ? { name: location } : {},
        status: "published",
        created_by_profile_id: auth.user.id,
      }).select("id,title,description,starts_at,ends_at,timezone,location,status,created_at").single();
      if (error || !data) throw new ApiError("GROUP_EVENT_CREATE_FAILED", "Unable to publish this Group event.", 500, undefined, false);
      return { data, status: 201 };
    }

    if (action === "link_giving" || action === "unlink_giving") {
      assertNoUnknownFields(body, ["action", "groupId", "givingPurposeId", "label", "note"]);
      if (!(await canManage(auth, groupId, "manage_content"))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot manage Group giving links.", 403);
      }
      const givingPurposeId = uuid(requiredString(body.givingPurposeId, "givingPurposeId", 36), "givingPurposeId", true)!;
      if (action === "unlink_giving") {
        const { error } = await admin.from("group_giving_options").delete()
          .eq("group_id", groupId)
          .eq("giving_purpose_id", givingPurposeId);
        if (error) throw new ApiError("GROUP_GIVING_UPDATE_FAILED", "Unable to remove this giving option.", 500, undefined, false);
        return { data: { givingPurposeId, linked: false } };
      }
      const { data: purpose, error: purposeError } = await admin.from("giving_purposes")
        .select("id,branch_id,name,status")
        .eq("id", givingPurposeId)
        .eq("organization_id", auth.organizationId)
        .eq("status", "active")
        .maybeSingle();
      if (purposeError || !purpose || (purpose.branch_id && purpose.branch_id !== group.branch_id)) {
        throw new ApiError("GIVING_PURPOSE_INVALID", "Choose an active giving destination for this Expression.", 422);
      }
      const { data, error } = await admin.from("group_giving_options").upsert({
        organization_id: auth.organizationId,
        group_id: groupId,
        giving_purpose_id: givingPurposeId,
        label: optionalText(body.label, "label", 160) || purpose.name,
        note: optionalText(body.note, "note", 1000),
        is_active: true,
        created_by_profile_id: auth.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "group_id,giving_purpose_id" })
        .select("id,giving_purpose_id,label,note,is_active,created_at,updated_at")
        .single();
      if (error || !data) throw new ApiError("GROUP_GIVING_UPDATE_FAILED", "Unable to add this giving option.", 500, undefined, false);
      return { data, status: 201 };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported Group action.", 422);
  },
));
