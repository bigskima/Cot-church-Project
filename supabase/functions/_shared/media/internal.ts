import type {
  MediaPlaybackGrant,
  MediaProcessingState,
  MediaProvider,
  MediaProviderConfiguration,
  MediaWebhookEvent,
  UploadIntentRequest,
  UploadIntentResponse,
} from './types.ts';

export class InternalStorageMediaProvider implements MediaProvider {
  readonly code = 'internal';

  async createUploadIntent(
    _config: MediaProviderConfiguration,
    request: UploadIntentRequest
  ): Promise<UploadIntentResponse> {
    const assetId = crypto.randomUUID();
    const ext = request.mimeType.split('/')[1] ?? 'bin';
    const storagePath = `orgs/${request.organizationId}/media/${assetId}/source.${ext}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return {
      assetId,
      providerAssetId: assetId,
      uploadUrl: `/storage/v1/object/upload/media/${storagePath}`,
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
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return {
      url: `/storage/v1/object/public/media/${providerAssetId}`,
      expiresAt,
    };
  }

  async deleteAsset(
    _config: MediaProviderConfiguration,
    _providerAssetId: string
  ): Promise<void> {
    // Internal deletion handled via storage API
  }

  async generateThumbnail(
    _config: MediaProviderConfiguration,
    _providerAssetId: string
  ): Promise<string> {
    return '';
  }

  async verifyWebhook(
    _config: MediaProviderConfiguration,
    rawBody: string,
    _headers: Headers
  ): Promise<MediaWebhookEvent> {
    const payload = JSON.parse(rawBody);
    return {
      eventId: payload.id ?? crypto.randomUUID(),
      eventType: payload.type ?? 'asset.ready',
      providerAssetId: payload.assetId ?? '',
      state: 'ready',
      raw: payload,
    };
  }
}
