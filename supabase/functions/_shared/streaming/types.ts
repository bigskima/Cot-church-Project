export type StreamLifecycle='scheduled'|'provisioning'|'ready'|'live'|'ended'|'processing'|'replay_ready'|'failed';
export interface ProviderConfiguration{providerCode:string;secretReference:string;webhookSecretReference:string;signingKeyReference?:string|null;settings:Record<string,unknown>}
export interface BroadcastRequest{title:string;visibility:'public'|'organization'|'branch'|'group'|'private';latencyMode:'standard'|'reduced'|'low';reconnectWindowSeconds:number;record:boolean}
export interface ProvisionedBroadcast{providerBroadcastId:string;ingest:{protocols:Array<'rtmp'|'srt'|'webrtc'>;rtmpUrl?:string;srtUrl?:string;streamKey:string};playbackId?:string;publicPlaybackUrl?:string;raw:Record<string,unknown>}
export interface PlaybackGrant{url:string;token?:string;expiresAt:string}
export interface ProviderWebhook{eventId:string;eventType:string;providerBroadcastId?:string;providerAssetId?:string;lifecycle?:StreamLifecycle;recording?:{providerAssetId:string;playbackId?:string;status:'preparing'|'ready'|'errored';durationSeconds?:number};raw:Record<string,unknown>}
export interface StreamingProvider{
 readonly code:string;createBroadcast(config:ProviderConfiguration,request:BroadcastRequest):Promise<ProvisionedBroadcast>;
 createIngestEndpoint(config:ProviderConfiguration,broadcastId:string):Promise<ProvisionedBroadcast['ingest']>;getStreamStatus(config:ProviderConfiguration,broadcastId:string):Promise<StreamLifecycle>;
 startBroadcast(config:ProviderConfiguration,broadcastId:string):Promise<void>;stopBroadcast(config:ProviderConfiguration,broadcastId:string):Promise<void>;
 createPlaybackToken(config:ProviderConfiguration,playbackId:string,ttlSeconds:number):Promise<PlaybackGrant>;
 verifyWebhook(config:ProviderConfiguration,rawBody:string,headers:Headers):Promise<ProviderWebhook>;
 getRecording(config:ProviderConfiguration,assetId:string):Promise<Record<string,unknown>>;createClip(config:ProviderConfiguration,assetId:string,startSeconds:number,endSeconds:number):Promise<{providerClipId:string}>;
 getAnalytics(config:ProviderConfiguration,broadcastId:string):Promise<Record<string,unknown>>;
}
