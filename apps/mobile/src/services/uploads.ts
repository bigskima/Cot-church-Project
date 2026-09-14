export type UploadFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
  file?: Blob;
};

const TRANSIENT_UPLOAD_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1400];

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function normalizeUploadMime(name: string, supplied?: string | null) {
  const mime = supplied?.toLowerCase().split(';')[0]?.trim() || '';
  const aliases: Record<string, string> = {
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'audio/mp3': 'audio/mpeg',
    'audio/x-wav': 'audio/wav',
    'image/jpg': 'image/jpeg',
    'video/x-m4v': 'video/mp4',
    'video/m4v': 'video/mp4',
  };
  if (aliases[mime]) return aliases[mime];
  if (mime && mime !== 'application/octet-stream') return mime;

  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4a') || lower.endsWith('.aac.mp4')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return mime || 'application/octet-stream';
}

export async function readUploadFile(file: UploadFile): Promise<Blob> {
  if (file.file) return file.file;
  const response = await fetch(file.uri);
  if (!response.ok) throw new Error('The selected file could not be read. Choose it again and retry.');
  return response.blob();
}

/**
 * Uploads to a Supabase signed upload URL on web, iOS and Android.
 * Browser-managed Content-Length is intentionally left alone because it is a
 * forbidden request header on the web. The declared MIME is normalized before
 * upload so Android/iOS picker aliases match the Storage bucket allow-list.
 */
export async function putSignedUpload(signedUploadUrl: string, file: UploadFile): Promise<number> {
  const body = await readUploadFile(file);
  const size = Number(body.size || file.size || 0);
  if (!size) throw new Error('The selected file is empty. Choose another file.');
  const mimeType = normalizeUploadMime(file.name, file.mimeType);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body,
      });

      if (response.ok) return size;

      const detail = await response.text().catch(() => '');
      const error = new Error(`File upload failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}.`);
      if (!TRANSIENT_UPLOAD_STATUSES.has(response.status) || attempt >= RETRY_DELAYS_MS.length) throw error;
      lastError = error;
    } catch (value) {
      const error = value instanceof Error ? value : new Error('File upload failed because the connection was interrupted.');
      const looksLikeHttpFailure = /File upload failed \(\d+\)/.test(error.message);
      if (looksLikeHttpFailure && !lastError) throw error;
      lastError = error;
      if (attempt >= RETRY_DELAYS_MS.length) break;
    }

    await delay(RETRY_DELAYS_MS[attempt]);
  }

  throw new Error(`${lastError?.message || 'The upload connection was interrupted.'} Your selected file is still available; retry publishing.`);
}
