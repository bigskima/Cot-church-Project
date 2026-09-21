import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '@/components/primitives/Icon';
import { Skeleton } from '@/components/primitives/Skeleton';

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
      return api.request('bible?' + query.toString(), { signal, context: 'public' });
    },
  );

  if (resource.loading && !resource.data) {
    return <Skeleton height={154} borderRadius={radius.xl} />;
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
          <Icon name="book-outline" size={18} color={colors.interactive} />
        </View>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.interactive }]}>TODAY'S SCRIPTURE</Text>
          <Text style={[styles.theme, { color: colors.textMuted }]}>{item.theme}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      <Text style={[styles.verse, { color: colors.text }]} numberOfLines={4}>{item.passage.text}</Text>
      <View style={styles.bottom}>
        <Text style={[styles.reference, { color: colors.text }]}>{item.reference}</Text>
        <Text style={[styles.version, { color: colors.textMuted }]}>{item.passage.abbreviation || 'WEB'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  icon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, lineHeight: 13, fontWeight: '900', letterSpacing: 0.9 },
  theme: { fontSize: 10.5, lineHeight: 15, textTransform: 'capitalize', marginTop: 1 },
  verse: { fontSize: 15.5, lineHeight: 24, fontWeight: '600' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reference: { fontSize: 11.5, fontWeight: '900' },
  version: { fontSize: 9.5, fontWeight: '700' },
});
