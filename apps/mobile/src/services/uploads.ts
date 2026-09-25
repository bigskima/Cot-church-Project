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
  const source = await readUploadFile(file);
  const mimeType = normalizeUploadMime(file.name, file.mimeType);
  const body = source.type === mimeType
    ? source
    : new Blob([await source.arrayBuffer()], { type: mimeType });
  const size = Number(body.size || file.size || 0);
  if (!size) throw new Error('The selected file is empty. Choose another file.');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body,
      });

      if (response.ok) return size;

      const error = new Error(response.status === 415
        ? 'This file format could not be uploaded. Choose the file again and retry.'
        : `File upload failed (${response.status}). Please try again.`);
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


type ResumableUploadSession = {
  signedUploadUrl: string;
  uploadToken?: string | null;
  storagePath: string;
  bucketName?: string;
};

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const TUS_RETRY_DELAYS_MS = [0, 1500, 3500, 7000];

function toBase64(value: string) {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(unescape(encodeURIComponent(value)));
  // React Native's global btoa is available in supported Expo runtimes.
  throw new Error('This device cannot prepare the media upload metadata.');
}

function resumableEndpointFromSignedUrl(signedUploadUrl: string) {
  const parsed = new URL(signedUploadUrl);
  const hostname = parsed.hostname.endsWith('.storage.supabase.co')
    ? parsed.hostname
    : parsed.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co');
  return `https://${hostname}/storage/v1/upload/resumable`;
}

async function readTusOffset(uploadUrl: string) {
  const response = await fetch(uploadUrl, {
    method: 'HEAD',
    headers: { 'Tus-Resumable': '1.0.0' },
  });
  if (!response.ok) throw new Error(`Unable to resume media upload (${response.status}).`);
  const offset = Number(response.headers.get('Upload-Offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('The media upload position could not be verified.');
  return offset;
}

/**
 * Uses Supabase Storage's TUS resumable protocol for large pastoral media.
 * Supabase recommends resumable uploads above 6 MB and documents 6 MB chunks,
 * progress events and direct storage hostnames for better large-file performance.
 */
export async function putSignedResumableUpload(
  session: ResumableUploadSession,
  file: UploadFile,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void,
): Promise<number> {
  const source = await readUploadFile(file);
  const mimeType = normalizeUploadMime(file.name, file.mimeType);
  const size = Number(source.size || file.size || 0);
  if (!size) throw new Error('The selected file is empty. Choose another file.');

  const endpoint = resumableEndpointFromSignedUrl(session.signedUploadUrl);
  const signature = session.uploadToken || new URL(session.signedUploadUrl).searchParams.get('token');
  if (!signature) throw new Error('The secure media upload session is incomplete. Please choose the file again.');

  const metadata = [
    ['bucketName', session.bucketName || 'content-media'],
    ['objectName', session.storagePath],
    ['contentType', mimeType],
    ['cacheControl', '3600'],
  ].map(([key, value]) => `${key} ${toBase64(value)}`).join(',');

  let uploadUrl = '';
  let offset = 0;

  for (let attempt = 0; attempt < TUS_RETRY_DELAYS_MS.length && !uploadUrl; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(size),
          'Upload-Metadata': metadata,
          'x-signature': signature,
        },
      });
      if (!response.ok) throw new Error(`Unable to start media upload (${response.status}).`);
      uploadUrl = response.headers.get('Location') || response.headers.get('location') || '';
      if (!uploadUrl) throw new Error('The media upload session did not return a resumable upload URL.');
    } catch (error) {
      if (attempt === TUS_RETRY_DELAYS_MS.length - 1) throw error instanceof Error ? error : new Error('Unable to start media upload.');
      await delay(TUS_RETRY_DELAYS_MS[attempt]);
    }
  }

  onProgress?.(0, size);

  while (offset < size) {
    const end = Math.min(offset + TUS_CHUNK_SIZE, size);
    const chunk = source.slice(offset, end);
    let uploaded = false;

    for (let attempt = 0; attempt < TUS_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const response = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunk,
        });
        if (!response.ok) throw new Error(`Media upload failed (${response.status}).`);
        const nextOffset = Number(response.headers.get('Upload-Offset') ?? end);
        if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset || nextOffset > size) {
          throw new Error('The media upload returned an invalid position.');
        }
        offset = nextOffset;
        onProgress?.(offset, size);
        uploaded = true;
        break;
      } catch (error) {
        if (attempt === TUS_RETRY_DELAYS_MS.length - 1) {
          // If the connection dropped after Storage accepted the chunk, resume
          // from Storage's authoritative offset instead of sending it again.
          offset = await readTusOffset(uploadUrl);
          onProgress?.(offset, size);
          if (offset >= size) {
            uploaded = true;
            break;
          }
        } else {
          await delay(TUS_RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    if (!uploaded) {
      throw new Error('The media upload was interrupted. Your file is still selected; please retry.');
    }
  }

  return size;
}
