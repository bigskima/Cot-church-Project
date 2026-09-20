export type ChatCallScope = 'direct' | 'expression' | 'group';
export type ChatCallKind = 'audio' | 'video';

export type ChatCall = {
  id: string;
  scope: ChatCallScope;
  organization_id?: string | null;
  expression_id?: string | null;
  conversation_id?: string | null;
  group_id?: string | null;
  section_id?: string | null;
  created_by_profile_id: string;
  call_kind: ChatCallKind;
  status: 'ringing' | 'active' | 'ended' | 'cancelled';
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
};

export type ChatCallParticipant = {
  call_id: string;
  profile_id: string;
  state: 'invited' | 'joined' | 'declined' | 'left' | 'missed';
  joined_at?: string | null;
  left_at?: string | null;
  profile?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

export type ChatCallGrant = {
  provider: 'agora';
  appId: string;
  channelName: string;
  token: string;
  uid: number;
  role: 'publisher';
  expiresAt: string;
};

export type ActiveCallPayload = {
  call: ChatCall;
  participants: ChatCallParticipant[];
};

export type JoinedCallPayload = ActiveCallPayload & {
  grant: ChatCallGrant;
};

export type AgoraCallSessionProps = {
  grant: ChatCallGrant;
  kind: ChatCallKind;
  onJoined?: () => void;
  onError?: (message: string) => void;
};
