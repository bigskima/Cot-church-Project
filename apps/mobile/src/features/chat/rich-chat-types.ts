export type ChatPerson = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export type ChatAttachment = {
  uploadId: string;
  type: 'image' | 'gif' | 'video' | 'audio';
  mimeType: string;
  fileName?: string | null;
  sizeBytes: number;
  durationSeconds?: number | null;
  url?: string | null;
};

export type ChatReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type ChatReply = {
  id: string;
  body?: string | null;
  sender_profile_id?: string | null;
  sender?: ChatPerson | null;
  attachmentType?: ChatAttachment['type'] | null;
};

export type RichChatMessage = {
  id: string;
  body: string;
  sent_at: string;
  sender_profile_id: string;
  sender?: ChatPerson | null;
  reply_to_id?: string | null;
  replyTo?: ChatReply | null;
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
  pinned_at?: string | null;
  pinned_by_profile_id?: string | null;
  redacted_at?: string | null;
  optimistic?: boolean;
};

export type ChatSendPayload = {
  body: string;
  replyToId?: string | null;
  attachments: ChatAttachment[];
};
