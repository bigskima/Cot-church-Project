import { Platform } from 'react-native';

export type UploadFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
  file?: Blob;
};

export async function readUploadFile(file: UploadFile): Promise<Blob> {
  if (file.file) return file.file;
  const response = await fetch(file.uri);
  if (!response.ok) throw new Error('The selected file could not be read. Choose it again and retry.');
  return response.blob();
}

/** Uploads to a Supabase signed upload URL on web, iOS and Android. */
export async function putSignedUpload(signedUploadUrl: string, file: UploadFile): Promise<number> {
  const body = await readUploadFile(file);
  const size = Number(body.size || file.size || 0);
  if (!size) throw new Error('The selected file is empty. Choose another file.');

  const response = await fetch(signedUploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.mimeType,
      // React Native's fetch accepts Blob bodies; the signed URL supplies authorization.
      ...(Platform.OS === 'web' ? { 'Content-Length': String(size) } : {}),
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`File upload failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}.`);
  }
  return size;
}
