import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { loadSafetyProfileSets } from "../_shared/safety.ts";
import { assertObject, requiredString, uuid } from "../_shared/validation.ts";

const BUCKET = "chat-media";
const MAX_BYTES = 100 * 1024 * 1024;
const MIME_TYPES: Record<string, { kind: "image" | "gif" | "video" | "audio"; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "gif", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/webm": { kind: "audio", ext: "webm" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/wav": { kind: "audio", ext: "wav" },
};

function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return uuid(String(value), field, true)!;
}
function attachmentIds(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError("VALIDATION_FAILED", "attachmentIds must be a list.", 422);
  const ids = [...new Set(value.map((item) => uuid(String(item), "attachmentId", true)!))];
  if (ids.length > 4) throw new ApiError("VALIDATION_FAILED", "A message can contain up to 4 attachments.", 422);
  return ids;
}
function text(value: unknown, field: string, max: number, allowBlank = false) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max || (!allowBlank && !value.trim())) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}.`, 422);
  }
  return value.trim();
}
function emojiValue(value: unknown) {
  const emoji = requiredString(value, "emoji", 16).trim();
  if (!emoji || Array.from(emoji).length > 8) throw new ApiError("VALIDATION_FAILED", "Choose a valid emoji.", 422);
  return emoji;
}
function targetDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime()) || date <= new Date()) throw new ApiError("VALIDATION_FAILED", "Choose a future restriction time.", 422);
  if (date.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) throw new ApiError("VALIDATION_FAILED", "Posting restrictions cannot exceed one year.", 422);
  return date.toISOString();
}
function safeFilename(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 255) : null;
}

async function mayModerate(auth: any, branchId: string) {
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: auth.organizationId,
    requested_permission: "members.update",
    target_branch_id: branchId,
  });
  if (error) throw new ApiError("EXPRESSION_PERMISSION_CHECK_FAILED", "Unable to verify Expression moderation access.", 500, undefined, false);
  return data === true;
}

async function expressionContext(auth: any, admin: any, branchId: string) {
  if (!auth.organizationId || !auth.branchId || auth.branchId !== branchId) {
    throw new ApiError("EXPRESSION_SCOPE_DENIED", "Open this discussion from the active Expression.", 403);
  }
  const [{ data: branch, error: branchError }, { data: membership, error: membershipError }] = await Promise.all([
    admin.from("branches").select("id,organization_id,name,is_active").eq("id", branchId).eq("organization_id", auth.organizationId).maybeSingle(),
    admin.from("expression_memberships")
      .select("id,organization_id,branch_id,profile_id,status,chat_restricted_until,chat_banned_at,chat_moderation_reason")
      .eq("organization_id", auth.organizationId).eq("branch_id", branchId).eq("profile_id", auth.user.id).eq("status", "active").maybeSingle(),
  ]);
  if (branchError || !branch || !branch.is_active || membershipError || !membership) {
    throw new ApiError("EXPRESSION_MEMBERSHIP_REQUIRED", "Active membership in this Expression is required.", 403);
  }
  return { branch, membership };
}

function assertMayAccess(membership: any) {
  if (membership.chat_banned_at) {
    throw new ApiError("EXPRESSION_CHAT_BANNED", "Your access to this Expression discussion is currently disabled.", 403);
  }
}

function assertMayPost(membership: any) {
  assertMayAccess(membership);
  if (membership.chat_restricted_until && new Date(membership.chat_restricted_until) > new Date()) {
    throw new ApiError("EXPRESSION_CHAT_RESTRICTED", `Posting is restricted until ${membership.chat_restricted_until}.`, 403);
  }
}

async function hydrate(admin: any, rows: any[], viewerId: string) {
  if (!rows.length) return [];
  const safety = await loadSafetyProfileSets(admin, viewerId);
  const visible = rows.filter((row) => !safety.hiddenFromFeed.has(row.sender_profile_id));
  const ids = visible.map((row) => row.id);
  const replyIds = [...new Set(visible.map((row) => row.reply_to_id).filter(Boolean))];
  const profileIds = [...new Set(visible.map((row) => row.sender_profile_id))];
  const uploadIds = [...new Set(visible.flatMap((row) => row.attachment_ids ?? []))];
  const [profilesResult, reactionsResult, repliesResult, uploadsResult] = await Promise.all([
    profileIds.length ? admin.from("profiles").select("id,username,display_name,avatar_url").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
    ids.length ? admin.from("expression_chat_reactions").select("message_id,profile_id,emoji").in("message_id", ids) : Promise.resolve({ data: [], error: null }),
    replyIds.length ? admin.from("expression_chat_messages").select("id,sender_profile_id,body,attachment_ids,sent_at,redacted_at").in("id", replyIds) : Promise.resolve({ data: [], error: null }),
    uploadIds.length ? admin.from("expression_chat_uploads").select("id,media_kind,mime_type,storage_path,size_bytes,duration_seconds,status").in("id", uploadIds).eq("status", "attached") : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error || reactionsResult.error || repliesResult.error || uploadsResult.error) {
    throw new ApiError("EXPRESSION_CHAT_LOAD_FAILED", "Unable to prepare this discussion.", 500, undefined, false);
  }
  const visibleReplies = (repliesResult.data ?? []).filter((row: any) => !safety.hiddenFromFeed.has(row.sender_profile_id));
  const extraReplyProfileIds = [...new Set(visibleReplies.map((row: any) => row.sender_profile_id).filter(Boolean))].filter((id) => !profileIds.includes(id));
  if (extraReplyProfileIds.length) {
    const extra = await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", extraReplyProfileIds);
    if (!extra.error) profilesResult.data = [...(profilesResult.data ?? []), ...(extra.data ?? [])];
  }
  const profileMap = new Map((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]));
  const replyMap = new Map(visibleReplies.map((reply: any) => [reply.id, reply]));
  const reactions = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
  for (const row of reactionsResult.data ?? []) {
    const byEmoji = reactions.get(row.message_id) ?? new Map();
    const current = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false };
    current.count += 1;
    if (row.profile_id === viewerId) current.reactedByMe = true;
    byEmoji.set(row.emoji, current);
    reactions.set(row.message_id, byEmoji);
  }
  const uploadMap = new Map<string, any>();
  const uploadRows = uploadsResult.data ?? [];
  if (uploadRows.length) {
    const signed = await admin.storage.from(BUCKET).createSignedUrls(uploadRows.map((row: any) => row.storage_path), 3600);
    if (signed.error) throw new ApiError("EXPRESSION_CHAT_LOAD_FAILED", "Unable to prepare discussion media.", 500, undefined, false);
    uploadRows.forEach((row: any, index: number) => {
      const url = signed.data?.[index]?.signedUrl ?? null;
      uploadMap.set(row.id, {
        uploadId: row.id,
        type: row.media_kind,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
        url,
      });
    });
  }
  return visible.map((row) => {
    const reply = row.reply_to_id ? replyMap.get(row.reply_to_id) : null;
    return {
      ...row,
      sender: profileMap.get(row.sender_profile_id) ?? null,
      replyTo: reply ? {
        id: reply.id,
        body: reply.redacted_at ? "Message removed" : reply.body,
        sender_profile_id: reply.sender_profile_id,
        sender: profileMap.get(reply.sender_profile_id) ?? null,
        attachmentType: reply.attachment_ids?.length ? uploadMap.get(reply.attachment_ids[0])?.type ?? null : null,
      } : null,
      attachments: (row.attachment_ids ?? []).map((id: string) => uploadMap.get(id)).filter(Boolean),
      reactions: [...(reactions.get(row.id)?.entries() ?? [])].map(([emoji, value]) => ({ emoji, ...value })),
      body: row.redacted_at ? "Message removed" : row.body,
    };
  });
}

async function targetMembership(admin: any, auth: any, branchId: string, targetProfileId: string) {
  const { data, error } = await admin.from("expression_memberships")
    .select("id,profile_id,status,chat_restricted_until,chat_banned_at,chat_moderation_reason")
    .eq("organization_id", auth.organizationId).eq("branch_id", branchId).eq("profile_id", targetProfileId).maybeSingle();
  if (error || !data) throw new ApiError("EXPRESSION_MEMBER_NOT_FOUND", "That Expression member is unavailable.", 404);
  return data;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.user || !auth.organizationId || !auth.branchId) throw new ApiError("AUTHENTICATION_REQUIRED", "Open an Expression before using its discussion.", 401);
    const admin = adminClient();
    const url = new URL(request.url);
    const body = request.method === "POST" ? assertObject(await jsonBody(request)) : {};
    const branchId = uuid(request.method === "GET" ? url.searchParams.get("branchId") : String(body.branchId ?? ""), "branchId", true)!;
    const { branch, membership } = await expressionContext(auth, admin, branchId);
    assertMayAccess(membership);
    const canModerate = await mayModerate(auth, branchId);

    if (request.method === "GET") {
      const { data: rows, error } = await admin.from("expression_chat_messages")
        .select("id,organization_id,branch_id,sender_profile_id,body,reply_to_id,attachment_ids,pinned_at,pinned_by_profile_id,sent_at,edited_at,redacted_at")
        .eq("organization_id", auth.organizationId).eq("branch_id", branchId).order("sent_at", { ascending: false }).limit(400);
      if (error) throw new ApiError("EXPRESSION_CHAT_LOAD_FAILED", "Unable to load this discussion.", 500, undefined, false);
      let members: any[] = [];
      if (canModerate) {
        const { data: memberRows, error: membersError } = await admin.from("expression_memberships")
          .select("id,profile_id,status,chat_restricted_until,chat_banned_at,chat_moderation_reason,joined_at")
          .eq("organization_id", auth.organizationId).eq("branch_id", branchId).order("joined_at", { ascending: true });
        if (membersError) throw new ApiError("EXPRESSION_CHAT_LOAD_FAILED", "Unable to load Expression members.", 500, undefined, false);
        const memberProfileIds = [...new Set((memberRows ?? []).map((row: any) => row.profile_id))];
        const { data: profiles } = memberProfileIds.length ? await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", memberProfileIds) : { data: [] as any[] };
        const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
        members = (memberRows ?? []).map((row: any) => ({ ...row, profile: profileMap.get(row.profile_id) ?? null }));
      }
      return { data: {
        expression: { id: branch.id, name: branch.name },
        membership,
        permissions: { moderateMembers: canModerate, pinMessages: canModerate },
        members,
        messages: await hydrate(admin, (rows ?? []).reverse(), auth.user.id),
      } };
    }

    const action = requiredString(body.action, "action", 40);
    if (action === "create_upload") {
      assertMayPost(membership);
      const mimeType = String(body.mimeType ?? "").trim().toLowerCase();
      const media = MIME_TYPES[mimeType];
      if (!media) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "This image, GIF, video, or audio format is not supported.", 415);
      const sizeBytes = Number(body.sizeBytes);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE", "Discussion media must be 100 MB or smaller.", 413);
      const durationSeconds = body.durationSeconds == null ? null : Math.max(0, Math.min(86400, Math.round(Number(body.durationSeconds))));
      const uploadId = crypto.randomUUID();
      const storagePath = `orgs/${auth.organizationId}/expressions/${branchId}/${auth.user.id}/${uploadId}.${media.ext}`;
      const { error } = await admin.from("expression_chat_uploads").insert({ id: uploadId, organization_id: auth.organizationId, branch_id: branchId, uploader_profile_id: auth.user.id, media_kind: media.kind, mime_type: mimeType, storage_path: storagePath, original_filename: safeFilename(body.fileName), size_bytes: sizeBytes, duration_seconds: durationSeconds });
      if (error) throw new ApiError("EXPRESSION_CHAT_UPLOAD_FAILED", "Unable to prepare this attachment.", 500, undefined, false);
      const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
      if (signed.error || !signed.data?.signedUrl) {
        await admin.from("expression_chat_uploads").delete().eq("id", uploadId);
        throw new ApiError("EXPRESSION_CHAT_UPLOAD_FAILED", "Unable to prepare this attachment.", 500, undefined, false);
      }
      return { data: { uploadId, type: media.kind, mimeType, sizeBytes, durationSeconds, signedUploadUrl: signed.data.signedUrl } };
    }

    if (action === "complete_upload" || action === "delete_upload") {
      assertMayPost(membership);
      const uploadId = uuid(String(body.uploadId ?? ""), "uploadId", true)!;
      const { data: upload, error } = await admin.from("expression_chat_uploads").select("id,storage_path,status,media_kind,mime_type,size_bytes,duration_seconds").eq("id", uploadId).eq("branch_id", branchId).eq("uploader_profile_id", auth.user.id).maybeSingle();
      if (error || !upload) throw new ApiError("EXPRESSION_CHAT_UPLOAD_NOT_FOUND", "This attachment is unavailable.", 404);
      if (action === "delete_upload") {
        if (upload.status === "attached") throw new ApiError("EXPRESSION_CHAT_UPLOAD_ATTACHED", "Sent attachments cannot be removed here.", 409);
        if (upload.status !== "deleted") {
          await admin.storage.from(BUCKET).remove([upload.storage_path]);
          await admin.from("expression_chat_uploads").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", upload.id);
        }
        return { data: { uploadId, deleted: true } };
      }
      if (upload.status === "uploaded" || upload.status === "attached") return { data: { uploadId, type: upload.media_kind, mimeType: upload.mime_type, sizeBytes: Number(upload.size_bytes), durationSeconds: upload.duration_seconds } };
      const path = upload.storage_path.split("/");
      const objectName = path.pop()!;
      const listed = await admin.storage.from(BUCKET).list(path.join("/"), { search: objectName, limit: 10 });
      if (listed.error || !(listed.data ?? []).some((item: any) => item.name === objectName)) throw new ApiError("EXPRESSION_CHAT_UPLOAD_INCOMPLETE", "The attachment has not finished uploading.", 409);
      await admin.from("expression_chat_uploads").update({ status: "uploaded" }).eq("id", upload.id).eq("status", "pending");
      return { data: { uploadId, type: upload.media_kind, mimeType: upload.mime_type, sizeBytes: Number(upload.size_bytes), durationSeconds: upload.duration_seconds } };
    }

    if (action === "send") {
      assertMayPost(membership);
      const messageBody = text(body.body, "message", 4000, true);
      const ids = attachmentIds(body.attachmentIds);
      if (!messageBody && !ids.length) throw new ApiError("VALIDATION_FAILED", "Write a message or attach media.", 422);
      if (ids.length) {
        const { data: uploads, error } = await admin.from("expression_chat_uploads").select("id").in("id", ids).eq("organization_id", auth.organizationId).eq("branch_id", branchId).eq("uploader_profile_id", auth.user.id).eq("status", "uploaded");
        if (error || (uploads ?? []).length !== ids.length) throw new ApiError("INVALID_CHAT_ATTACHMENTS", "One or more attachments are unavailable.", 422);
      }
      const replyToId = optionalUuid(body.replyToId, "replyToId");
      if (replyToId) {
        const { data: reply } = await admin.from("expression_chat_messages").select("id").eq("id", replyToId).eq("organization_id", auth.organizationId).eq("branch_id", branchId).maybeSingle();
        if (!reply) throw new ApiError("MESSAGE_NOT_FOUND", "The message you are replying to is unavailable.", 404);
      }
      const { data: created, error } = await admin.from("expression_chat_messages").insert({ organization_id: auth.organizationId, branch_id: branchId, sender_profile_id: auth.user.id, body: messageBody, reply_to_id: replyToId, attachment_ids: ids }).select("id,organization_id,branch_id,sender_profile_id,body,reply_to_id,attachment_ids,pinned_at,pinned_by_profile_id,sent_at,edited_at,redacted_at").single();
      if (error || !created) throw new ApiError("EXPRESSION_CHAT_SEND_FAILED", "Unable to send this message.", 500, undefined, false);
      if (ids.length) await admin.from("expression_chat_uploads").update({ status: "attached", attached_at: new Date().toISOString() }).in("id", ids).eq("status", "uploaded");
      return { data: (await hydrate(admin, [created], auth.user.id))[0] };
    }

    if (action === "react") {
      const messageId = uuid(String(body.messageId ?? ""), "messageId", true)!;
      const emoji = emojiValue(body.emoji);
      const { data: message } = await admin.from("expression_chat_messages").select("id").eq("id", messageId).eq("organization_id", auth.organizationId).eq("branch_id", branchId).maybeSingle();
      if (!message) throw new ApiError("MESSAGE_NOT_FOUND", "This message is unavailable.", 404);
      const { data: existing } = await admin.from("expression_chat_reactions").select("id").eq("message_id", messageId).eq("profile_id", auth.user.id).eq("emoji", emoji).maybeSingle();
      if (existing) await admin.from("expression_chat_reactions").delete().eq("id", existing.id);
      else await admin.from("expression_chat_reactions").insert({ message_id: messageId, profile_id: auth.user.id, emoji });
      return { data: { reacted: !existing } };
    }

    if (action === "pin") {
      if (!canModerate) throw new ApiError("PERMISSION_DENIED", "Expression moderation access is required.", 403);
      const messageId = uuid(String(body.messageId ?? ""), "messageId", true)!;
      const pinned = body.pinned === true;
      const { error } = await admin.from("expression_chat_messages").update({ pinned_at: pinned ? new Date().toISOString() : null, pinned_by_profile_id: pinned ? auth.user.id : null }).eq("id", messageId).eq("organization_id", auth.organizationId).eq("branch_id", branchId);
      if (error) throw new ApiError("EXPRESSION_CHAT_MODERATION_FAILED", "Unable to update that pin.", 500, undefined, false);
      return { data: { pinned } };
    }

    if (["restrict_member", "ban_member", "remove_member"].includes(action)) {
      if (!canModerate) throw new ApiError("PERMISSION_DENIED", "Expression moderation access is required.", 403);
      const targetProfileId = uuid(String(body.targetProfileId ?? ""), "targetProfileId", true)!;
      if (targetProfileId === auth.user.id) throw new ApiError("VALIDATION_FAILED", "Use another authorized operator for changes to your own access.", 422);
      const target = await targetMembership(admin, auth, branchId, targetProfileId);
      const reason = text(body.reason, "reason", 500, true) || null;
      if (action === "restrict_member") {
        const until = targetDate(body.restrictedUntil);
        const { error } = await admin.from("expression_memberships").update({ chat_restricted_until: until, chat_moderation_reason: until ? reason : null, chat_moderated_by_profile_id: auth.user.id }).eq("id", target.id);
        if (error) throw new ApiError("EXPRESSION_CHAT_MODERATION_FAILED", "Unable to update posting access.", 500, undefined, false);
        return { data: { targetProfileId, restrictedUntil: until } };
      }
      if (action === "ban_member") {
        const banned = body.banned !== false;
        const { error } = await admin.from("expression_memberships").update({ chat_banned_at: banned ? new Date().toISOString() : null, chat_restricted_until: null, chat_moderation_reason: banned ? reason : null, chat_moderated_by_profile_id: auth.user.id }).eq("id", target.id);
        if (error) throw new ApiError("EXPRESSION_CHAT_MODERATION_FAILED", "Unable to update discussion access.", 500, undefined, false);
        return { data: { targetProfileId, banned } };
      }
      const { error } = await admin.from("expression_memberships").update({ status: "left", left_at: new Date().toISOString(), chat_banned_at: null, chat_restricted_until: null, chat_moderation_reason: reason, chat_moderated_by_profile_id: auth.user.id }).eq("id", target.id).eq("status", "active");
      if (error) throw new ApiError("EXPRESSION_MEMBER_REMOVE_FAILED", "Unable to remove this member from the Expression.", 500, undefined, false);
      return { data: { targetProfileId, removed: true } };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported discussion action.", 422);
  },
));