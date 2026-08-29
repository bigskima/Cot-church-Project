import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, PostCard, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { SocialPost } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;
type Scope = 'global' | 'expression';

export default function CommunityScreen() {
  const { api, mode, context } = useSession();
  const [scope, setScope] = useState<Scope>('global');

  const feed = useResource<SocialPost[]>(`feed:${scope}`, (signal) =>
    mode === 'visitor'
      ? api.request<SocialPost[]>(`public-content?organizationId=${organization}&type=feed`, { signal })
      : api.request<SocialPost[]>('social-feed', { signal })
  );

  const posts = feed.data?.filter((post) =>
    scope === 'global' ? post.visibility === 'public' : post.visibility !== 'public'
  ) ?? [];

  const handleReact = async (postId: string, reaction: string) => {
    if (mode === 'visitor') return;
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({ action: 'react', postId, reaction }),
      });
      feed.refresh();
    } catch {
      // Ignore reaction failure
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Sanctuary Community"
        subtitle="Encouragement, testimonies, and updates from your spiritual family."
      />

      {/* Scope Selector Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabPillContainer}>
          {(['global', 'expression'] as Scope[]).map((val) => {
            const isSelected = scope === val;
            const isDisabled = mode === 'visitor' && val === 'expression';
            const label = val === 'global' ? 'Global Church' : (context?.expression?.name ?? 'My Expression');

            return (
              <Pressable
                key={val}
                disabled={isDisabled}
                onPress={() => setScope(val)}
                style={({ pressed }) => [
                  styles.tabPill,
                  isSelected && styles.tabPillActive,
                  isDisabled && styles.tabPillDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    isSelected && styles.tabPillTextActive,
                    isDisabled && styles.tabPillTextDisabled,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Feed List */}
      {feed.loading ? (
        <View style={styles.loadingWrapper}>
          <Skeleton height={200} />
          <Skeleton height={200} />
        </View>
      ) : feed.error && !feed.data ? (
        <View style={styles.errorWrapper}>
          <ResourceError
            offline={feed.offline}
            message={feed.error}
            retry={feed.refresh}
          />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={feed.refresh}
          refreshing={feed.refreshing}
          renderItem={({ item }) => (
            <PostCard post={item} onReact={(reaction) => handleReact(item.id, reaction)} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No Community Updates Yet"
              message="New testimonies, pastoral messages, and ministry fellowship updates will appear here."
              icon="🕊️"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tabPillContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E2D8',
    padding: 4,
    borderRadius: radius.pill,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: palette.surface,
    ...shadows.sm,
  },
  tabPillDisabled: {
    opacity: 0.4,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.inkSecondary,
  },
  tabPillTextActive: {
    color: palette.navy,
    fontWeight: '900',
  },
  tabPillTextDisabled: {
    color: palette.muted,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  loadingWrapper: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  errorWrapper: {
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
