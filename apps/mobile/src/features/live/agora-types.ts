export type AgoraRtcGrant = {
  provider: 'agora';
  appId: string;
  channelName: string;
  token: string;
  uid: number;
  role: 'publisher' | 'subscriber';
  expiresAt: string;
};

export type AgoraLiveSessionProps = {
  grant: AgoraRtcGrant;
  role: 'publisher' | 'subscriber';
  onJoined?: () => void;
  onLeave?: () => void;
  onRemoteLeft?: () => void;
  onError?: (message: string) => void;
};
