import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { ApiError } from "./errors.ts";
import { loadPublicChatBadges } from "./identity-badges.ts";

export const CHAT_MEDIA_BUCKET = "chat-media";
export const MAX_CHAT_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_CHAT_ATTACHMENTS = 4;

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

type ChatScope = {
  conversationId?: string | null;
  organizationId?: string | null;
  groupId?: string | null;
  sectionId?: string | null;
};

function safeFileName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 255) : null;
}

function validSize(value: unknown) {
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_CHAT_MEDIA_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Chat media must be 100 MB or smaller.", 413);
  }
  return size;
}

function validDuration(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400) {
    throw new ApiError("VALIDATION_FAILED", "Media duration is invalid.", 422);
  }
  return Math.round(duration);
}

function validDimension(value: unknown, field: "width" | "height") {
  if (value === undefined || value === null || value === "") return null;
  const dimension = Number(value);
  if (!Number.isSafeInteger(dimension) || dimension < 1 || dimension > 32768) {
    throw new ApiError("VALIDATION_FAILED", `Media ${field} is invalid.`, 422);
  }
  return dimension;
}

export function chatAttachmentIds(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError("VALIDATION_FAILED", "attachmentIds must be a list.", 422);
  const ids = [...new Set(value.map((item) => String(item).trim()))];
  if (ids.length > MAX_CHAT_ATTACHMENTS) {
    throw new ApiError("VALIDATION_FAILED", `A message can contain up to ${MAX_CHAT_ATTACHMENTS} attachments.`, 422);
  }
  if (ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw new ApiError("VALIDATION_FAILED", "An attachment identifier is invalid.", 422);
  }
  return ids;
}

export async function createChatUpload(
  admin: SupabaseClient,
  profileId: string,
  scope: ChatScope,
  values: { mimeType: unknown; fileName?: unknown; sizeBytes: unknown; durationSeconds?: unknown; width?: unknown; height?: unknown },
) {
  const mimeType = String(values.mimeType ?? "").trim().toLowerCase();
  const media = MIME_TYPES[mimeType];
  if (!media) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "This image, GIF, video, or audio format is not supported.", 415);
  const sizeBytes = validSize(values.sizeBytes);
  const durationSeconds = media.kind === "video" || media.kind === "audio"
    ? validDuration(values.durationSeconds)
    : null;
  const width = media.kind === "image" || media.kind === "gif" || media.kind === "video"
    ? validDimension(values.width, "width")
    : null;
  const height = media.kind === "image" || media.kind === "gif" || media.kind === "video"
    ? validDimension(values.height, "height")
    : null;
  const uploadId = crypto.randomUUID();
  const scopePath = scope.conversationId
    ? `direct/${scope.conversationId}`
    : `orgs/${scope.organizationId}/groups/${scope.groupId}/${scope.sectionId ?? "main"}`;
  const storagePath = `${scopePath}/${profileId}/${uploadId}.${media.ext}`;

  const { error: recordError } = await admin.from("chat_media_uploads").insert({
    id: uploadId,
    uploader_profile_id: profileId,
    conversation_id: scope.conversationId ?? null,
    organization_id: scope.organizationId ?? null,
    group_id: scope.groupId ?? null,
    section_id: scope.sectionId ?? null,
    media_kind: media.kind,
    mime_type: mimeType,
    storage_path: storagePath,
    original_filename: safeFileName(values.fileName),
    size_bytes: sizeBytes,
    duration_seconds: durationSeconds,
    width,
    height,
    status: "pending",
  });
  if (recordError) throw new ApiError("CHAT_UPLOAD_FAILED", "We couldn’t prepare this attachment.", 500, undefined, false);

  const { data: signed, error: signedError } = await admin.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (signedError || !signed?.signedUrl) {
    await admin.from("chat_media_uploads").delete().eq("id", uploadId);
    throw new ApiError("CHAT_UPLOAD_FAILED", "We couldn’t prepare this attachment.", 500, undefined, false);
  }

  return {
    uploadId,
    type: media.kind,
    mimeType,
    sizeBytes,
    durationSeconds,
    width,
    height,
    fileName: safeFileName(values.fileName),
    signedUploadUrl: signed.signedUrl,
  };
}

function scopedUploadQuery(query: any, profileId: string, uploadId: string, scope: ChatScope) {
  let next = query.eq("id", uploadId).eq("uploader_profile_id", profileId);
  if (scope.conversationId) next = next.eq("conversation_id", scope.conversationId);
  if (scope.groupId) next = next.eq("group_id", scope.groupId);
  if (scope.sectionId) next = next.eq("section_id", scope.sectionId);
  else if (scope.groupId) next = next.is("section_id", null);
  return next;
}

export async function completeChatUpload(
  admin: SupabaseClient,
  profileId: string,
  uploadId: string,
  scope: ChatScope,
) {
  const { data: upload, error: lookupError } = await scopedUploadQuery(
    admin.from("chat_media_uploads")
      .select("id,media_kind,mime_type,storage_path,original_filename,size_bytes,duration_seconds,width,height,status"),
    profileId,
    uploadId,
    scope,
  ).maybeSingle();
  if (lookupError || !upload) throw new ApiError("CHAT_UPLOAD_NOT_FOUND", "This attachment is unavailable.", 404);
  if (upload.status === "attached" || upload.status === "uploaded") return attachmentPayload(upload);
  if (upload.status !== "pending") throw new ApiError("CHAT_UPLOAD_NOT_FOUND", "This attachment is unavailable.", 409);

  const segments = upload.storage_path.split("/");
  const objectName = segments.pop()!;
  const directory = segments.join("/");
  const { data: objects, error: listError } = await admin.storage
    .from(CHAT_MEDIA_BUCKET)
    .list(directory, { limit: 10, search: objectName });
  if (listError) throw new ApiError("CHAT_UPLOAD_FAILED", "We couldn’t verify this attachment.", 500, undefined, false);
  const object = (objects ?? []).find((item) => item.name === objectName);
  if (!object) throw new ApiError("CHAT_UPLOAD_INCOMPLETE", "The attachment has not finished uploading.", 409);
  const actualSize = Number((object as any).metadata?.size ?? upload.size_bytes);
  if (!Number.isSafeInteger(actualSize) || actualSize < 1 || actualSize > MAX_CHAT_MEDIA_BYTES) {
    await admin.storage.from(CHAT_MEDIA_BUCKET).remove([upload.storage_path]);
    await admin.from("chat_media_uploads").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", upload.id);
    throw new ApiError("PAYLOAD_TOO_LARGE", "Chat media must be 100 MB or smaller.", 413);
  }

  const { data: completed, error: completeError } = await admin.from("chat_media_uploads")
    .update({ status: "uploaded", size_bytes: actualSize })
    .eq("id", upload.id)
    .eq("status", "pending")
    .select("id,media_kind,mime_type,original_filename,size_bytes,duration_seconds,width,height,status")
    .single();
  if (completeError || !completed) throw new ApiError("CHAT_UPLOAD_FAILED", "We couldn’t finish this attachment.", 500, undefined, false);
  return attachmentPayload(completed);
}

export async function deleteChatUpload(
  admin: SupabaseClient,
  profileId: string,
  uploadId: string,
  scope: ChatScope,
) {
  const { data: upload, error } = await scopedUploadQuery(
    admin.from("chat_media_uploads").select("id,storage_path,status"),
    profileId,
    uploadId,
    scope,
  ).maybeSingle();
  if (error || !upload) throw new ApiError("CHAT_UPLOAD_NOT_FOUND", "This attachment is unavailable.", 404);
  if (upload.status === "attached") throw new ApiError("CHAT_UPLOAD_ATTACHED", "Sent attachments cannot be removed here.", 409);
  if (upload.status !== "deleted") {
    await admin.storage.from(CHAT_MEDIA_BUCKET).remove([upload.storage_path]);
    await admin.from("chat_media_uploads")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", upload.id);
  }
  return { uploadId, deleted: true };
}

export async function purgeAttachedChatUploads(
  admin: SupabaseClient,
  profileId: string,
  attachmentIds: string[],
) {
  if (!attachmentIds.length) return;
  const { data: uploads } = await admin
    .from("chat_media_uploads")
    .select("id,storage_path,status")
    .in("id", attachmentIds)
    .eq("uploader_profile_id", profileId);
  const rows = uploads ?? [];
  const storagePaths = rows
    .filter((item: any) => item.status !== "deleted" && item.storage_path)
    .map((item: any) => item.storage_path);
  if (storagePaths.length) {
    await admin.storage.from(CHAT_MEDIA_BUCKET).remove(storagePaths);
  }
  if (rows.length) {
    await admin.from("chat_media_uploads")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .in("id", rows.map((item: any) => item.id))
      .eq("uploader_profile_id", profileId);
  }
}

export async function validateChatUploads(
  admin: SupabaseClient,
  profileId: string,
  attachmentIds: string[],
  scope: ChatScope,
) {
  if (!attachmentIds.length) return;
  let query: any = admin.from("chat_media_uploads")
    .select("id")
    .in("id", attachmentIds)
    .eq("uploader_profile_id", profileId)
    .eq("status", "uploaded");
  if (scope.conversationId) query = query.eq("conversation_id", scope.conversationId);
  if (scope.groupId) query = query.eq("group_id", scope.groupId);
  if (scope.sectionId) query = query.eq("section_id", scope.sectionId);
  else if (scope.groupId) query = query.is("section_id", null);
  const { data, error } = await query;
  if (error || (data ?? []).length !== attachmentIds.length) {
    throw new ApiError("INVALID_CHAT_ATTACHMENTS", "One or more attachments are unavailable.", 422);
  }
}

export async function markChatUploadsAttached(admin: SupabaseClient, attachmentIds: string[]) {
  if (!attachmentIds.length) return;
  const { error } = await admin.from("chat_media_uploads")
    .update({ status: "attached", attached_at: new Date().toISOString() })
    .in("id", attachmentIds)
    .eq("status", "uploaded");
  if (error) throw new ApiError("CHAT_SEND_FAILED", "We couldn’t attach media to this message.", 500, undefined, false);
}

function attachmentPayload(upload: any, url?: string | null) {
  return {
    uploadId: upload.id,
    type: upload.media_kind,
    mimeType: upload.mime_type,
    fileName: upload.original_filename,
    sizeBytes: Number(upload.size_bytes),
    durationSeconds: upload.duration_seconds == null ? null : Number(upload.duration_seconds),
    width: upload.width == null ? null : Number(upload.width),
    height: upload.height == null ? null : Number(upload.height),
    url: url ?? null,
  };
}

export async function signedChatAttachments(admin: SupabaseClient, ids: string[]) {
  const uniqueIds = [...new Set(ids)].slice(0, 2000);
  const result = new Map<string, ReturnType<typeof attachmentPayload>>();
  if (!uniqueIds.length) return result;
  const { data: uploads, error } = await admin.from("chat_media_uploads")
    .select("id,media_kind,mime_type,storage_path,original_filename,size_bytes,duration_seconds,width,height,status")
    .in("id", uniqueIds)
    .eq("status", "attached");
  if (error) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t prepare chat attachments.", 500, undefined, false);

  const rows = uploads ?? [];
  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    const { data: signed, error: signError } = await admin.storage
      .from(CHAT_MEDIA_BUCKET)
      .createSignedUrls(batch.map((item: any) => item.storage_path), 3600);
    if (signError) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t prepare chat attachments.", 500, undefined, false);
    batch.forEach((upload: any, index: number) => {
      const signedUrl = signed?.[index]?.signedUrl ?? null;
      if (signedUrl) result.set(upload.id, attachmentPayload(upload, signedUrl));
    });
  }
  return result;
}

export async function messageReactionMap(
  admin: SupabaseClient,
  table: "direct_message_reactions" | "group_message_reactions",
  messageIds: string[],
  viewerId: string,
) {
  const result = new Map<string, Array<{ emoji: string; count: number; reactedByMe: boolean }>>();
  if (!messageIds.length) return result;
  const { data, error } = await admin.from(table).select("message_id,profile_id,emoji").in("message_id", messageIds);
  if (error) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t load message reactions.", 500, undefined, false);
  const counts = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
  for (const row of data ?? []) {
    const emojis = counts.get(row.message_id) ?? new Map();
    const current = emojis.get(row.emoji) ?? { count: 0, reactedByMe: false };
    current.count += 1;
    if (row.profile_id === viewerId) current.reactedByMe = true;
    emojis.set(row.emoji, current);
    counts.set(row.message_id, emojis);
  }
  counts.forEach((emojis, messageId) => {
    result.set(messageId, [...emojis.entries()].map(([emoji, value]) => ({ emoji, ...value })));
  });
  return result;
}

function publicSender(profile: any, badges: any[] = []) {
  return profile ? {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    badges,
  } : null;
}

export async function hydrateChatMessages(
  admin: SupabaseClient,
  messageTable: "direct_messages" | "group_messages",
  reactionTable: "direct_message_reactions" | "group_message_reactions",
  rows: any[],
  viewerId: string,
  hiddenProfileIds: Set<string> = new Set<string>(),
  identityScope: { organizationId?: string | null; branchId?: string | null } = {},
) {
  if (!rows.length) return [];
  const messageIds = rows.map((message) => message.id);
  const rowMap = new Map(rows.map((message) => [message.id, message]));
  const missingReplyIds = [...new Set(rows
    .map((message) => message.reply_to_id)
    .filter((id): id is string => Boolean(id) && !rowMap.has(id)))];
  const { data: missingReplies, error: repliesError } = missingReplyIds.length
    ? await admin.from(messageTable)
        .select("id,sender_profile_id,body,attachment_ids,sent_at,redacted_at")
        .in("id", missingReplyIds)
    : { data: [] as any[], error: null };
  if (repliesError) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t map message replies.", 500, undefined, false);
  for (const reply of missingReplies ?? []) {
    if (!hiddenProfileIds.has(reply.sender_profile_id)) rowMap.set(reply.id, reply);
  }

  const allRows = [...rows, ...(missingReplies ?? []).filter((reply: any) => !hiddenProfileIds.has(reply.sender_profile_id))];
  const profileIds = [...new Set(allRows.map((message) => message.sender_profile_id).filter(Boolean))];
  const attachmentIds = [...new Set(allRows.flatMap((message) => message.attachment_ids ?? []))];
  const [{ data: profiles, error: profilesError }, attachmentMap, reactions, badgeMap] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,username,display_name,avatar_url").in("id", profileIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    signedChatAttachments(admin, attachmentIds),
    messageReactionMap(admin, reactionTable, messageIds, viewerId),
    loadPublicChatBadges(admin, profileIds, identityScope.organizationId, identityScope.branchId),
  ]);
  if (profilesError) throw new ApiError("CHAT_LOAD_FAILED", "We couldn’t load message senders.", 500, undefined, false);
  const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

  const compactReply = (reply: any) => reply ? {
    id: reply.id,
    body: reply.redacted_at ? "Message removed" : reply.body,
    sender_profile_id: reply.sender_profile_id,
    sender: publicSender(profileMap.get(reply.sender_profile_id), badgeMap.get(reply.sender_profile_id) ?? []),
    attachmentType: (reply.attachment_ids ?? []).map((id: string) => attachmentMap.get(id)?.type).find(Boolean) ?? null,
  } : null;

  return rows.map((message) => ({
    ...message,
    body: message.redacted_at ? "Message removed" : message.body,
    sender: publicSender(profileMap.get(message.sender_profile_id), badgeMap.get(message.sender_profile_id) ?? []),
    attachments: message.redacted_at
      ? []
      : (message.attachment_ids ?? []).map((id: string) => attachmentMap.get(id)).filter(Boolean),
    reactions: reactions.get(message.id) ?? [],
    replyTo: compactReply(message.reply_to_id ? rowMap.get(message.reply_to_id) : null),
  }));
}
