import { Platform } from 'react-native';

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

export async function readUploadFile(file: UploadFile): Promise<Blob> {
  if (file.file) return file.file;
  const response = await fetch(file.uri);
  if (!response.ok) throw new Error('The selected file could not be read. Choose it again and retry.');
  return response.blob();
}

/**
 * Uploads to a Supabase signed upload URL on web, iOS and Android.
 *
 * Signed URLs are short-lived, so retries are deliberately limited and only cover
 * transient connectivity/server responses. Permanent validation/auth failures are
 * surfaced immediately instead of repeatedly sending the same file.
 */
export async function putSignedUpload(signedUploadUrl: string, file: UploadFile): Promise<number> {
  const body = await readUploadFile(file);
  const size = Number(body.size || file.size || 0);
  if (!size) throw new Error('The selected file is empty. Choose another file.');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.mimeType,
          // React Native's fetch accepts Blob bodies; the signed URL supplies authorization.
          ...(Platform.OS === 'web' ? { 'Content-Length': String(size) } : {}),
        },
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
