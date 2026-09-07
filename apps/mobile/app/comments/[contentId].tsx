import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentsThread, ResourceError, ScreenHeader } from '@/components';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { spacing } from '@/design-system/tokens';
import type { ContentComment } from '@/types/content';

export default function CommentsScreen({ forcedScope }: { forcedScope?: 'general' | 'expression' } = {}) {
  const { contentId, context: requestedContext } = useLocalSearchParams<{ contentId: string; context?: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const expressionMode = forcedScope ? forcedScope === 'expression' : requestedContext === 'expression';
  const requestContext = expressionMode ? 'current' : 'public';

  const comments = useResource<ContentComment[]>(
    `comments:screen:${expressionMode ? context?.expression?.id ?? 'none' : 'public'}:${contentId}`,
    async (signal) => {
      if (!contentId) throw new Error('This conversation is unavailable.');
      if (expressionMode && (mode !== 'authenticated' || !context?.expression?.id)) {
        throw new Error('Enter this Expression to view its conversation.');
      }
      return api.request<ContentComment[]>(
        `engagement?contentId=${encodeURIComponent(contentId)}`,
        { signal, context: requestContext },
      );
    },
  );

  const returnTo = forcedScope === 'general' ? `/general/comments/${encodeURIComponent(contentId)}` : `/comments/${encodeURIComponent(contentId)}${expressionMode ? '?context=expression' : '?context=public'}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Comments" showBack />
      </View>

      {comments.error && !comments.data ? (
        <ResourceError message={comments.error} retry={comments.refresh} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xl },
            ]}
          >
            <CommentsThread
              comments={comments.data ?? []}
              loading={comments.loading}
              canComment={mode === 'authenticated'}
              onRequireSignIn={() => router.push({
                pathname: '/(auth)/login',
                params: { returnTo },
              } as any)}
              onSubmitComment={async (body, parentCommentId) => {
                if (!contentId) throw new Error('This conversation is unavailable.');
                await api.request('engagement', {
                  method: 'POST',
                  context: requestContext,
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
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
});
