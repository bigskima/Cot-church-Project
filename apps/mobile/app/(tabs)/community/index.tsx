import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, PostCard, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { SocialPost } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;
type Scope = 'global' | 'expression';

export default function CommunityScreen() {
  const { api, mode, context } = useSession();
  const { colors, isDark } = useTheme();
  const [scope, setScope] = useState<Scope>('global');

  const feed = useResource<SocialPost[]>(`feed:${scope}`, (signal) =>
    mode === 'visitor'
      ? api.request<SocialPost[]>(
          `public-content?type=feed${organization ? `&organizationId=${organization}` : ''}`,
          { signal }
        )
      : api.request<SocialPost[]>('social-feed', { signal })
  );

  const posts =
    feed.data?.filter((post) =>
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
      // Ignored
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Sanctuary Community"
        subtitle="Encouragement, testimonies, and updates from your spiritual family."
        dark={isDark}
      />

      {/* Scope Selector Tabs */}
      <View style={styles.tabContainer}>
        <View
          style={[
            styles.tabPillContainer,
            { backgroundColor: isDark ? '#22140C' : '#E8D5C4' },
          ]}
        >
          {(['global', 'expression'] as Scope[]).map((val) => {
            const isSelected = scope === val;
            const isDisabled = mode === 'visitor' && val === 'expression';
            const label =
              val === 'global'
                ? 'Global Church'
                : 'My Expression';

            return (
              <Pressable
                key={val}
                disabled={isDisabled}
                onPress={() => setScope(val)}
                style={({ pressed }) => [
                  styles.tabPill,
                  isSelected ? {
                    backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                    ...shadows.sm,
                  } : null,
                  isDisabled ? styles.disabledPill : null,
                  pressed ? styles.pressed : null,
                ] as any}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    { color: isSelected ? colors.text : colors.textMuted },
                    isSelected ? styles.tabPillTextActive : null,
                  ] as any}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Expression Leadership Quick Button */}
        {scope === 'expression' && mode === 'authenticated' && (
          <Pressable
            onPress={() => router.push('/(tabs)/community/leadership' as any)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: isDark ? '#1C1008' : '#FFFDF9',
              padding: 12,
              borderRadius: radius.md,
              marginTop: 10,
              borderWidth: 1,
              borderColor: isDark ? '#3D2415' : palette.line,
            } as any}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 } as any}>👥</Text>
              <Text style={{ fontWeight: '800', color: colors.text, fontSize: 13 } as any}>
                View Campus Pastoral & Ministry Leadership
              </Text>
            </View>
            <Text style={{ color: palette.gold, fontSize: 14, fontWeight: '900' } as any}>›</Text>
          </Pressable>
        )}
      </View>

      {/* Feed List */}
      {feed.loading ? (
        <View style={styles.loadingWrapper as any}>
          <Skeleton height={200} count={2} dark={isDark} />
        </View>
      ) : feed.error && !feed.data ? (
        <View style={styles.errorWrapper as any}>
          <ResourceError
            offline={feed.offline}
            message={feed.error}
            retry={feed.refresh}
            dark={isDark}
          />
        </View>
      ) : posts.length > 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onReact={(reaction) => handleReact(item.id, reaction)}
            />
          )}
          contentContainerStyle={styles.listContent as any}
          refreshControl={
            <RefreshControl
              refreshing={feed.loading}
              onRefresh={feed.refresh}
              tintColor={colors.primary}
            />
          }
        />
      ) : (
        <View style={styles.emptyWrapper as any}>
          <EmptyState
            title="No Community Posts Yet"
            message={
              scope === 'expression'
                ? 'Your church expression feed is quiet right now. Check back soon for announcements and fellowship.'
                : 'Global church feed has no published updates.'
            }
            icon="✦"
            dark={isDark}
          />
        </View>
      )}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tabPillContainer: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tabPillTextActive: {
    fontWeight: '900',
  },
  disabledPill: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  loadingWrapper: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  errorWrapper: {
    paddingHorizontal: spacing.lg,
  },
  emptyWrapper: {
    paddingHorizontal: spacing.lg,
  },
});
