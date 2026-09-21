import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '@/components/primitives/Icon';
import { Skeleton } from '@/components/states';

type TodayScripture = {
  reference: string;
  theme: string;
  date: string;
  passage: { text: string; abbreviation?: string };
};

export function DailyScriptureHomeCard() {
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';

  const resource = useResource<TodayScripture>(
    'bible:home-today:' + (organizationId || 'auto'),
    (signal) => {
      const query = new URLSearchParams({ action: 'today' });
      if (organizationId) query.set('organizationId', organizationId);
      return api.request('noop?service=bible&' + query.toString(), { signal, context: 'public' });
    },
  );

  if (resource.loading && !resource.data) {
    return <Skeleton height={108} borderRadius={radius.xl} />;
  }
  if (!resource.data) return null;

  const item = resource.data;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/general/bible', params: { reference: item.reference } } as any)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        shadows.sm,
        pressed && { opacity: 0.9 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={'Open today Scripture, ' + item.reference}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="book-outline" size={16} color={colors.interactive} />
        </View>
        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <Text style={[styles.kicker, { color: colors.interactive }]}>TODAY'S SCRIPTURE</Text>
            <View style={[styles.themeChip, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.theme, { color: colors.interactive }]} numberOfLines={1}>{item.theme}</Text>
            </View>
          </View>
          <Text style={[styles.verse, { color: colors.text }]} numberOfLines={2}>{item.passage.text}</Text>
        </View>
        <View style={styles.end}>
          <Icon name="chevron-forward" size={17} color={colors.textMuted} />
          <Text style={[styles.readLabel, { color: colors.interactive }]}>Read</Text>
        </View>
      </View>
      <View style={styles.bottom}>
        <Text style={[styles.reference, { color: colors.text }]}>{item.reference}</Text>
        <Text style={[styles.version, { color: colors.textMuted }]}>{item.passage.abbreviation || 'WEB'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 11, gap: 7, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.75 },
  themeChip: { maxWidth: 92, minHeight: 21, borderRadius: radius.pill, paddingHorizontal: 7, justifyContent: 'center' },
  theme: { fontSize: 8.5, lineHeight: 11, fontWeight: '800', textTransform: 'capitalize' },
  verse: { fontSize: 13.5, lineHeight: 19, fontWeight: '650' },
  end: { width: 32, alignItems: 'center', gap: 2 },
  readLabel: { fontSize: 8, fontWeight: '900' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 43 },
  reference: { fontSize: 10.5, fontWeight: '900' },
  version: { fontSize: 8.5, fontWeight: '700' },
});
