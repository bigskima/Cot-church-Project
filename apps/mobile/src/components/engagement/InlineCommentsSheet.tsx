import React from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import type { ContentComment } from '@/types/content';
import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';
import { ResourceError } from '../states';
import { CommentsThread } from './CommentsThread';

export type InlineCommentsContext = 'public' | 'current';

export type InlineCommentsSheetProps = {
  visible: boolean;
  onClose: () => void;
  contentId?: string | null;
  context?: InlineCommentsContext;
  title?: string;
  subtitle?: string;
  onViewAll?: () => void;
  returnTo?: string;
};

export function InlineCommentsSheet({
  visible,
  onClose,
  contentId,
  context = 'public',
  title = 'Comments',
  subtitle = 'Keep the content in view while you join the conversation.',
  onViewAll,
  returnTo = '/general',
}: InlineCommentsSheetProps) {
  const { api, mode } = useSession();
  const key = `comments:inline:${context}:${contentId ?? 'none'}`;
  const comments = useResource<ContentComment[]>(
    key,
    (signal) => visible && contentId
      ? api.request<ContentComment[]>(
          `engagement?contentId=${encodeURIComponent(contentId)}`,
          { signal, context },
        )
      : Promise.resolve([]),
  );

  const requireSignIn = () => {
    onClose();
    router.push({
      pathname: '/(auth)/login',
      params: { returnTo },
    } as any);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxHeightPercent={76}
    >
      {!contentId ? (
        <ResourceError message="Comments are not available for this content yet." />
      ) : comments.error && !comments.data ? (
        <ResourceError message={comments.error} retry={comments.refresh} />
      ) : (
        <View>
          <CommentsThread
            comments={comments.data ?? []}
            loading={comments.loading}
            canComment={mode === 'authenticated'}
            canReport={mode === 'authenticated'}
            reportContext={context}
            onRequireSignIn={requireSignIn}
            onSubmitComment={async (body, parentCommentId) => {
              await api.request('engagement', {
                method: 'POST',
                context,
                body: JSON.stringify({
                  action: 'comment',
                  contentId,
                  body,
                  parentCommentId: parentCommentId ?? undefined,
                }),
              });
              comments.refresh();
            }}
          />
          {onViewAll ? (
            <Button
              label="View all comments"
              variant="outline"
              size="md"
              fullWidth
              onPress={() => {
                onClose();
                onViewAll();
              }}
              style={{ marginTop: 16 }}
            />
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
