import { Platform, Share } from 'react-native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type ShareAttachment = {
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
};

type ShareContent = {
  title?: string;
  message: string;
  attachment?: ShareAttachment | null;
  url?: string | null;
};

function extensionForMime(mimeType?: string | null) {
  if (!mimeType) return 'bin';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/mp4') return 'm4a';
  if (mimeType === 'audio/webm') return 'webm';
  if (mimeType === 'audio/ogg') return 'ogg';
  if (mimeType === 'audio/wav') return 'wav';
  const subtype = mimeType.split('/')[1]?.split(';')[0]?.replace(/[^a-z0-9]+/gi, '');
  return subtype || 'bin';
}

function safeFileName(content: ShareContent, mimeType?: string | null) {
  const supplied = content.attachment?.fileName?.trim();
  if (supplied) return supplied;
  const base = (content.title || 'cot-media').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cot-media';
  return `${base}.${extensionForMime(mimeType)}`;
}

async function shareFileOnWeb(content: ShareContent) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || !content.attachment?.url) return false;
  try {
    const response = await fetch(content.attachment.url);
    if (!response.ok) return false;
    const blob = await response.blob();
    const mimeType = content.attachment.mimeType || blob.type || 'application/octet-stream';
    const file = new File([blob], safeFileName(content, mimeType), { type: mimeType });
    const payload = { title: content.title, text: content.message, files: [file] };
    if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) return false;
    await navigator.share(payload);
    return true;
  } catch {
    return false;
  }
}

function base64Bytes(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function nativeAttachmentUri(content: ShareContent) {
  const attachment = content.attachment;
  if (!attachment?.url) return null;
  const source = attachment.url;
  if (/^file:\/\//i.test(source)) return source;

  const destination = new ExpoFile(Paths.cache, `${Date.now()}-${safeFileName(content, attachment.mimeType)}`);

  if (/^data:/i.test(source)) {
    const comma = source.indexOf(',');
    if (comma < 0) throw new Error('The shared media is invalid.');
    const metadata = source.slice(0, comma);
    const payload = source.slice(comma + 1);
    if (/;base64/i.test(metadata)) destination.write(base64Bytes(payload));
    else destination.write(decodeURIComponent(payload));
    return destination.uri;
  }

  if (/^https?:\/\//i.test(source)) {
    const downloaded = await ExpoFile.downloadFileAsync(source, destination);
    return downloaded.uri;
  }

  return source;
}

async function shareFileOnNative(content: ShareContent) {
  if (Platform.OS === 'web' || !content.attachment?.url) return false;
  try {
    if (!await Sharing.isAvailableAsync()) return false;
    const uri = await nativeAttachmentUri(content);
    if (!uri) return false;
    await Sharing.shareAsync(uri, {
      dialogTitle: content.title || 'Share from COT',
      mimeType: content.attachment.mimeType || undefined,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Shares real media files on web and native. Native attachments are first
 * materialized into the app cache when needed so Android/iOS receiving apps get
 * an actual image/video/audio file instead of an inaccessible data URI.
 */
export async function shareContent(content: ShareContent) {
  if (Platform.OS === 'web' && await shareFileOnWeb(content)) return;
  if (Platform.OS !== 'web' && await shareFileOnNative(content)) return;

  const fallbackUrl = content.url || (content.attachment?.url && /^https?:\/\//i.test(content.attachment.url) ? content.attachment.url : undefined);
  await Share.share({
    title: content.title,
    message: content.message,
    ...(fallbackUrl ? { url: fallbackUrl } : {}),
  });
}
