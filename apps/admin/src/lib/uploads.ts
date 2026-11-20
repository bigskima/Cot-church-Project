const TRANSIENT_UPLOAD_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1400];

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Upload a browser File to a short-lived signed URL with bounded retries.
 * Permanent validation/auth failures are surfaced immediately; only transient
 * HTTP responses and connection interruptions are retried.
 */
export async function putSignedBrowserUpload(signedUploadUrl: string, file: File): Promise<void> {
  if (!file.size) throw new Error('The selected file is empty. Choose another file.');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (response.ok) return;

      const detail = await response.text().catch(() => '');
      const error = new Error(`File upload failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}.`);
      if (!TRANSIENT_UPLOAD_STATUSES.has(response.status) || attempt >= RETRY_DELAYS_MS.length) throw error;
      lastError = error;
    } catch (value) {
      const error = value instanceof Error ? value : new Error('File upload failed because the connection was interrupted.');
      const httpMatch = error.message.match(/File upload failed \((\d+)\)/);
      if (httpMatch) {
        const status = Number(httpMatch[1]);
        if (!TRANSIENT_UPLOAD_STATUSES.has(status)) throw error;
      }
      lastError = error;
      if (attempt >= RETRY_DELAYS_MS.length) break;
    }

    await delay(RETRY_DELAYS_MS[attempt]);
  }

  throw new Error(`${lastError?.message || 'The upload connection was interrupted.'} The selected file is still available; try again.`);
}
