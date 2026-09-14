import { Platform, Share } from 'react-native';

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

/**
 * Shares the actual media file where the browser exposes Web Share Level 2.
 * Native uses the operating-system share sheet with the media URL so receiving
 * apps can fetch the attachment; text-only sharing remains the final fallback.
 */
export async function shareContent(content: ShareContent) {
  if (Platform.OS === 'web' && await shareFileOnWeb(content)) return;

  const url = content.attachment?.url || content.url || undefined;
  await Share.share({
    title: content.title,
    message: content.message,
    ...(url ? { url } : {}),
  });
}
