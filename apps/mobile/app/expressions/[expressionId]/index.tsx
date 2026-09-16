import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components';
import { ExpressionLayeredHomeExperience } from '@/features/expression/ExpressionLayeredHomeExperience';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type PublicExpressionPayload = { expression?: { address?: unknown } | null };

function addressDisplay(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const address = value as Record<string, unknown>;
  const locality = [address.city, address.state].filter(Boolean).join(', ');
  return [address.line1, address.line2, locality, address.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

export default function ExpressionHomeScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { colors } = useTheme();
  const { api } = useSession();
  const location = useResource<PublicExpressionPayload>(
    `expression:home:location:${id || 'none'}`,
    (signal) => id ? api.request<PublicExpressionPayload>(`public-content?type=expression&expressionId=${encodeURIComponent(id)}`, { signal, context: 'public' }) : Promise.resolve({}),
  );
  const address = addressDisplay(location.data?.expression?.address);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <TourAnchor targetKey="expression.header">
        <Pressable
          onPress={() => id && router.push(`/expressions/${id}/notifications` as any)}
          accessibilityRole="button"
          accessibilityLabel="Open Expression notifications"
          style={({ pressed }) => [styles.notificationBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}><Icon name="notifications-outline" size={18} color={colors.interactive} /></View>
          <View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>Expression notifications</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Only updates from this Expression</Text></View>
          <Icon name="chevron-forward" size={17} color={colors.textMuted} />
        </Pressable>
      </TourAnchor>

      {address ? (
        <Pressable
          onPress={() => router.push(`/expressions/${id}/location` as any)}
          accessibilityRole="button"
          accessibilityLabel="Open Expression location"
          style={({ pressed }) => [styles.locationBar, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }, pressed && styles.pressed]}
        >
          <View style={[styles.locationIcon, { backgroundColor: colors.cardElevated }]}><Icon name="location" size={17} color={colors.interactive} /></View>
          <View style={styles.copy}><Text style={[styles.locationEyebrow, { color: colors.interactive }]}>EXPRESSION LOCATION</Text><Text style={[styles.locationText, { color: colors.text }]} numberOfLines={2}>{address}</Text></View>
          <Icon name="map-outline" size={18} color={colors.interactive} />
        </Pressable>
      ) : null}

      <TourAnchor targetKey="expression.home.hero" style={styles.content}>
        <ExpressionLayeredHomeExperience expressionId={id} />
      </TourAnchor>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
  notificationBar: { marginHorizontal: spacing.md, marginTop: spacing.sm, minHeight: 58, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationBar: { marginHorizontal: spacing.md, marginTop: spacing.xs, minHeight: 60, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 12.5, fontWeight: '800' },
  subtitle: { fontSize: 10.5, marginTop: 2 },
  locationEyebrow: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 },
  locationText: { fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
