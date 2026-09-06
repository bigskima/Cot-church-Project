import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

type SavedType = 'post' | 'reel' | 'video' | 'sermon';
type SavedFilter = 'all' | SavedType;

type SavedItem = {
  contentId: string;
  routeId: string;
  type: SavedType;
  savedAt: string;
  organizationId: string;
  expressionId: string | null;
  visibility: string;
  publishedAt?: string | null;
  title: string;
  summary: string;
  meta?: string | null;
};

const filters: Array<{ key: SavedFilter; label: string; icon: string }> = [
  { key: 'all', label: 'All', icon: 'bookmark-outline' },
  { key: 'post', label: 'Posts', icon: 'chatbox-ellipses-outline' },
  { key: 'reel', label: 'Reels', icon: 'play-circle-outline' },
  { key: 'video', label: 'Videos', icon: 'videocam-outline' },
  { key: 'sermon', label: 'Sermons', icon: 'headset-outline' },
];

function typeLabel(type: SavedType) {
  if (type === 'post') return 'POST';
  if (type === 'reel') return 'REEL';
  if (type === 'video') return 'WATCH';
  return 'SERMON';
}

function typeIcon(type: SavedType) {
  if (type === 'post') return 'chatbox-ellipses-outline';
  if (type === 'reel') return 'play-circle-outline';
  if (type === 'video') return 'videocam-outline';
  return 'headset-outline';
}

export default function SavedLibraryScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const [filter, setFilter] = React.useState<SavedFilter>('all');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');

  const resource = useResource<SavedItem[]>(`saved-library:${mode}`, (signal) => {
    if (mode !== 'authenticated') return Promise.resolve([]);
    return api.request<SavedItem[]>('engagement?view=saved', { signal, context: 'public' });
  });

  const items = React.useMemo(
    () => (resource.data ?? []).filter((item) => filter === 'all' || item.type === filter),
    [resource.data, filter],
  );

  const openItem = (item: SavedItem) => {
    const expressionOnly = item.visibility !== 'public' && Boolean(item.expressionId);
    if (expressionOnly && context?.expression?.id !== item.expressionId) {
      setMessage('Enter the Expression where this was published before opening it.');
      return;
    }
    const contentContext = expressionOnly ? 'expression' : 'public';
    if (item.type === 'reel') {
      router.push({ pathname: '/reels', params: { reelId: item.routeId, context: contentContext } } as any);
      return;
    }
    if (item.type === 'video') {
      router.push({ pathname: '/watch/[id]', params: { id: item.routeId, context: contentContext } } as any);
      return;
    }
    if (item.type === 'sermon') {
      router.push({ pathname: '/sermon/[id]', params: { id: item.routeId, context: contentContext } } as any);
      return;
    }
    router.push('/(tabs)/community');
  };

  const remove = async (item: SavedItem) => {
    setBusyId(item.contentId);
    setMessage('');
    try {
      const result = await api.request<{ bookmarked: boolean }>('engagement', {
        method: 'POST',
        context: item.visibility === 'public' ? 'public' : 'current',
        body: JSON.stringify({ action: 'bookmark', contentId: item.contentId }),
      });
      if (result.bookmarked) throw new Error('This item is still saved. Please try again.');
      await resource.refresh();
    } catch (value) {
      setMessage(value instanceof Error ? value.message : 'Unable to remove this saved item.');
    } finally {
      setBusyId(null);
    }
  };

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.stateScreen, { backgroundColor: colors.bg }]}>
        <EmptyState title="Sign in to see Saved" message="Your bookmarks are connected to your COT account so they can follow you across devices." iconName="bookmark-outline" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 80 }]}
      >
        <ScreenHeader title="Saved" kicker="YOUR LIBRARY" subtitle="Posts, Reels, Watch videos and sermons you kept for later." showBack />

        <View style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {filters.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                selected={filter === item.key}
                onPress={() => setFilter(item.key)}
                icon={<Icon name={item.icon} size={14} color={filter === item.key ? colors.interactive : colors.textSecondary} />}
              />
            ))}
          </ScrollView>
        </View>

        {message ? (
          <Pressable onPress={() => setMessage('')} style={[styles.message, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Icon name="information-circle-outline" size={18} color={colors.interactive} />
            <Text style={[styles.messageText, { color: colors.textSecondary }]}>{message}</Text>
            <Icon name="close" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {resource.loading && !resource.data ? (
          <View style={styles.list}><Skeleton height={124} count={4} /></View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : items.length ? (
          <View style={styles.list}>
            {items.map((item) => {
              const expressionLocked = item.visibility !== 'public' && Boolean(item.expressionId) && context?.expression?.id !== item.expressionId;
              return (
                <View key={item.contentId} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <Pressable onPress={() => openItem(item)} style={({ pressed }) => [styles.openArea, pressed && styles.pressed]}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
                      <Icon name={typeIcon(item.type)} size={23} color={colors.interactive} />
                    </View>
                    <View style={styles.cardCopy}>
                      <View style={styles.cardMetaRow}>
                        <View style={[styles.typePill, { backgroundColor: colors.bgSecondary }]}>
                          <Text style={[styles.typeText, { color: colors.interactive }]}>{typeLabel(item.type)}</Text>
                        </View>
                        {expressionLocked ? (
                          <View style={styles.lockMeta}>
                            <Icon name="lock-closed-outline" size={12} color={colors.textMuted} />
                            <Text style={[styles.lockText, { color: colors.textMuted }]}>Enter Expression</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                      {item.summary ? <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={2}>{item.summary}</Text> : null}
                      <Text style={[styles.savedAt, { color: colors.textMuted }]}>Saved {new Date(item.savedAt).toLocaleDateString()}</Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                  <View style={[styles.cardFooter, { borderColor: colors.borderSubtle }]}>
                    <Button
                      label="Remove from Saved"
                      variant="ghost"
                      size="sm"
                      loading={busyId === item.contentId}
                      onPress={() => void remove(item)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title={filter === 'all' ? 'Nothing saved yet' : `No saved ${filters.find((item) => item.key === filter)?.label.toLowerCase() ?? 'items'}`}
            message="Use the bookmark action on church content and it will appear here."
            iconName="bookmark-outline"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stateScreen: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  filterBar: { borderWidth: 1, borderRadius: radius.xxl, paddingVertical: spacing.sm },
  filterContent: { paddingHorizontal: spacing.sm, gap: spacing.xs },
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  openArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconBox: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, gap: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typePill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  typeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  lockMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lockText: { fontSize: 10, fontWeight: '700' },
  title: { ...typography.h3 },
  summary: { fontSize: 12, lineHeight: 18 },
  savedAt: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'flex-end', paddingHorizontal: spacing.sm, paddingVertical: 4 },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  messageText: { flex: 1, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
});
