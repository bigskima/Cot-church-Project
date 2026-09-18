import { ApiError } from '../errors.ts';
import { resolveSecretJson } from '../secrets.ts';
import * as AgoraToken from 'npm:agora-token@2.0.6';
import type { BroadcastRequest, PlaybackGrant, ProviderConfiguration, ProviderWebhook, ProvisionedBroadcast, RtcGrant, StreamingProvider, StreamLifecycle } from './types.ts';

type AgoraCredentials = { appId: string; appCertificate: string };

async function credentials(config: ProviderConfiguration) {
  const value = await resolveSecretJson<AgoraCredentials>(config.secretReference);
  const appId = typeof value.appId === 'string' ? value.appId.trim() : '';
  const appCertificate = typeof value.appCertificate === 'string' ? value.appCertificate.trim() : '';
  const credentialPattern = /^[0-9a-fA-F]{32}$/;

  if (!credentialPattern.test(appId) || !credentialPattern.test(appCertificate)) {
    throw new ApiError(
      'AGORA_CREDENTIALS_INVALID',
      'Agora App ID and Primary Certificate must be valid 32-character hexadecimal values',
      503,
      undefined,
      false,
    );
  }

  return { appId, appCertificate };
}

function rtcTokenApi() {
  const token = AgoraToken as unknown as {
    RtcTokenBuilder?: { buildTokenWithUid: (...args: any[]) => string };
    RtcRole?: { PUBLISHER: number; SUBSCRIBER: number };
    default?: {
      RtcTokenBuilder?: { buildTokenWithUid: (...args: any[]) => string };
      RtcRole?: { PUBLISHER: number; SUBSCRIBER: number };
    };
  };
  const RtcTokenBuilder = token.RtcTokenBuilder ?? token.default?.RtcTokenBuilder;
  const RtcRole = token.RtcRole ?? token.default?.RtcRole;
  if (!RtcTokenBuilder || !RtcRole) {
    throw new ApiError('STREAMING_ADAPTER_UNAVAILABLE', 'Agora token generator is unavailable', 500, undefined, false);
  }
  return { RtcTokenBuilder, RtcRole };
}

export class AgoraStreamingProvider implements StreamingProvider {
  readonly code = 'agora';

  async createBroadcast(_config: ProviderConfiguration, request: BroadcastRequest): Promise<ProvisionedBroadcast> {
    if (request.visibility === 'public') {
      throw new ApiError('STREAMING_SCOPE_UNSUPPORTED', 'Agora is reserved for Expression and private COT broadcasts', 422);
    }
    const channelName = `cot_${crypto.randomUUID().replace(/-/g, '')}`;
    return {
      providerBroadcastId: channelName,
      ingest: { protocols: ['webrtc'] },
      rtc: { channelName },
      raw: { channelName, mode: 'live', roleModel: 'host_audience' },
    };
  }

  async createIngestEndpoint(_config: ProviderConfiguration, broadcastId: string) {
    return { protocols: ['webrtc'] as Array<'webrtc'>, streamKey: undefined, rtmpUrl: undefined, channelName: broadcastId } as any;
  }

  async getStreamStatus(): Promise<StreamLifecycle> {
    // Agora RTC channels are ephemeral. COT remains authoritative for the
    // scheduled/ready/live/ended lifecycle and updates it when the host joins/leaves.
    return 'ready';
  }

  async startBroadcast() { return; }
  async stopBroadcast() { return; }

  async createPlaybackToken(): Promise<PlaybackGrant> {
    throw new ApiError('STREAMING_PLAYBACK_MODE_INVALID', 'Agora uses RTC grants instead of HLS playback URLs', 409);
  }

  async createRtcGrant(
    config: ProviderConfiguration,
    channelName: string,
    uid: number,
    role: 'publisher' | 'subscriber',
    ttlSeconds: number,
  ): Promise<RtcGrant> {
    const value = await credentials(config);
    const { RtcTokenBuilder, RtcRole } = rtcTokenApi();
    const normalizedTtl = Math.max(300, Math.min(86400, Math.floor(ttlSeconds)));
    const token = RtcTokenBuilder.buildTokenWithUid(
      value.appId,
      value.appCertificate,
      channelName,
      uid,
      role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      normalizedTtl,
      normalizedTtl,
    );
    return {
      provider: 'agora',
      appId: value.appId,
      channelName,
      token,
      uid,
      role,
      expiresAt: new Date(Date.now() + normalizedTtl * 1000).toISOString(),
    };
  }

  async verifyWebhook(): Promise<ProviderWebhook> {
    throw new ApiError('STREAMING_WEBHOOK_UNSUPPORTED', 'Agora RTC does not use the Mux webhook contract', 501);
  }

  async getRecording(): Promise<Record<string, unknown>> {
    throw new ApiError('STREAMING_RECORDING_UNSUPPORTED', 'Agora cloud recording is not enabled in the free COT launch profile', 501);
  }

  async createClip(): Promise<{ providerClipId: string }> {
    throw new ApiError('STREAMING_CLIP_UNSUPPORTED', 'Clips are unavailable for the Agora free launch profile', 501);
  }

  async getAnalytics(_config: ProviderConfiguration, broadcastId: string) {
    return { channelName: broadcastId, provider: 'agora', lifecycleAuthority: 'cot' };
  }
}
