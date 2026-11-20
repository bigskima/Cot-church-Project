export type MediaProcessingState = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';
export type MediaAssetType = 'video' | 'audio' | 'image';
export type MediaRenditionKind = 'video_stream' | 'video_download' | 'audio_stream' | 'audio_download' | 'thumbnail' | 'waveform';

export interface MediaProviderConfiguration {
  providerCode: string;
  secretReference: string;
  webhookSecretReference?: string | null;
  signingKeyReference?: string | null;
  settings: Record<string, unknown>;
}

export interface UploadIntentRequest {
  mediaType: MediaAssetType;
  mimeType: string;
  fileSizeBytes?: number | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  organizationId: string;
  expressionId?: string | null;
}

export interface UploadIntentResponse {
  assetId: string;
  providerAssetId?: string;
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface MediaPlaybackGrant {
  url: string;
  token?: string;
  expiresAt: string;
  renditions?: Array<{
    kind: MediaRenditionKind;
    url: string;
    width?: number;
    height?: number;
    bitrate?: number;
  }>;
}

export interface MediaWebhookEvent {
  eventId: string;
  eventType: string;
  providerAssetId: string;
  state: MediaProcessingState;
  durationSeconds?: number;
  width?: number;
  height?: number;
  aspectRatio?: string;
  renditions?: Array<{
    kind: MediaRenditionKind;
    container: string;
    codec: string;
    width?: number;
    height?: number;
    bitrate?: number;
    providerPlaybackId?: string;
    storagePath?: string;
  }>;
  errorMessage?: string;
  raw: Record<string, unknown>;
}

export interface MediaProvider {
  readonly code: string;
  createUploadIntent(config: MediaProviderConfiguration, request: UploadIntentRequest): Promise<UploadIntentResponse>;
  getAssetStatus(config: MediaProviderConfiguration, providerAssetId: string): Promise<MediaProcessingState>;
  resolvePlayback(config: MediaProviderConfiguration, providerAssetId: string, ttlSeconds: number): Promise<MediaPlaybackGrant>;
  deleteAsset(config: MediaProviderConfiguration, providerAssetId: string): Promise<void>;
  generateThumbnail(config: MediaProviderConfiguration, providerAssetId: string): Promise<string>;
  verifyWebhook(config: MediaProviderConfiguration, rawBody: string, headers: Headers): Promise<MediaWebhookEvent>;
}
