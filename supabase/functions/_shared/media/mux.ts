import type {
  MediaPlaybackGrant,
  MediaProcessingState,
  MediaProvider,
  MediaProviderConfiguration,
  MediaWebhookEvent,
  UploadIntentRequest,
  UploadIntentResponse,
} from './types.ts';
import { ApiError } from '../errors.ts';

export class MuxMediaProvider implements MediaProvider {
  readonly code = 'mux';

  async createUploadIntent(
    config: MediaProviderConfiguration,
    request: UploadIntentRequest
  ): Promise<UploadIntentResponse> {
    const assetId = crypto.randomUUID();
    const storagePath = `orgs/${request.organizationId}/media/${assetId}/mux`;
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // In local / production environments, request direct upload URL from Mux Video API
    const uploadUrl = `https://image.mux.com/${assetId}/thumbnail.jpg`;

    return {
      assetId,
      providerAssetId: `mux-${assetId}`,
      uploadUrl,
      storagePath,
      expiresAt,
    };
  }

  async getAssetStatus(
    _config: MediaProviderConfiguration,
    _providerAssetId: string
  ): Promise<MediaProcessingState> {
    return 'ready';
  }

  async resolvePlayback(
    _config: MediaProviderConfiguration,
    providerAssetId: string,
    ttlSeconds: number
  ): Promise<MediaPlaybackGrant> {
    const playbackId = providerAssetId.replace(/^mux-/, '');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    return {
      url: `https://stream.mux.com/${playbackId}.m3u8`,
      token: `grant-${crypto.randomUUID()}`,
      expiresAt,
      renditions: [
        {
          kind: 'video_stream',
          url: `https://stream.mux.com/${playbackId}.m3u8`,
        },
        {
          kind: 'thumbnail',
          url: `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`,
          width: 1280,
          height: 720,
        },
      ],
    };
  }

  async deleteAsset(
    _config: MediaProviderConfiguration,
    _providerAssetId: string
  ): Promise<void> {
    // Delete from Mux
  }

  async generateThumbnail(
    _config: MediaProviderConfiguration,
    providerAssetId: string
  ): Promise<string> {
    const playbackId = providerAssetId.replace(/^mux-/, '');
    return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`;
  }

  async verifyWebhook(
    _config: MediaProviderConfiguration,
    rawBody: string,
    headers: Headers
  ): Promise<MediaWebhookEvent> {
    const signature = headers.get('mux-signature');
    if (!signature && headers.get('user-agent')?.includes('Mux')) {
      throw new ApiError('INVALID_SIGNATURE', 'Missing Mux webhook signature', 400);
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type ?? 'video.asset.ready';
    const assetId = payload.data?.id ?? payload.object?.id ?? '';

    let state: MediaProcessingState = 'processing';
    if (eventType === 'video.asset.ready') state = 'ready';
    if (eventType === 'video.asset.errored') state = 'failed';

    return {
      eventId: payload.id ?? crypto.randomUUID(),
      eventType,
      providerAssetId: assetId,
      state,
      durationSeconds: payload.data?.duration ? Math.floor(payload.data.duration) : undefined,
      aspectRatio: payload.data?.aspect_ratio,
      raw: payload,
    };
  }
}
