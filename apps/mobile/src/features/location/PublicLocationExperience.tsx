import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useGeneralMinistryAccess } from '@/features/general/useGeneralMinistryAccess';

type LocationRecord = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  landmark?: string | null;
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ExpressionPayload = {
  expression?: { id: string; name: string; address?: LocationRecord | string | null } | null;
};

function normalizeLocation(value: unknown): LocationRecord | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() ? { line1: value.trim() } : null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as LocationRecord;
  const hasValue = [source.line1, source.line2, source.city, source.state, source.country, source.landmark, source.mapUrl, source.latitude, source.longitude]
    .some((item) => item !== null && item !== undefined && String(item).trim() !== '');
  return hasValue ? source : null;
}

function displayAddress(location: LocationRecord) {
  const locality = [location.city, location.state].filter(Boolean).join(', ');
  return [location.line1, location.line2, locality, location.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function googleMapsUrl(location: LocationRecord) {
  if (location.mapUrl?.trim()) return location.mapUrl.trim();
  if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
  }
  const query = [displayAddress(location), location.landmark].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleEmbedUrl(location: LocationRecord) {
  const query = Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? `${location.latitude},${location.longitude}`
    : [displayAddress(location), location.landmark].filter(Boolean).join(', ');
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

export function PublicLocationExperience({ scope, expressionId }: { scope: 'general' | 'expression'; expressionId?: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, context } = useSession();
  const generalAccess = useGeneralMinistryAccess();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const [copied, setCopied] = React.useState(false);

  const resource = useResource<{ name: string; location: LocationRecord | null }>(
    `public-location:${scope}:${expressionId ?? organizationId ?? 'none'}`,
    async (signal) => {
      if (scope === 'expression') {
        if (!expressionId) return { name: 'Expression', location: null };
        const data = await api.request<ExpressionPayload>(`public-content?type=expression&expressionId=${encodeURIComponent(expressionId)}`, { signal, context: 'public' });
        return { name: data.expression?.name ?? 'Expression', location: normalizeLocation(data.expression?.address) };
      }
      const suffix = organizationId ? `?view=location&organizationId=${encodeURIComponent(organizationId)}` : '?view=location';
      const location = await api.request<LocationRecord | null>(`church-story${suffix}`, { signal, context: 'public' });
      return { name: context?.organization?.name ?? context?.organizations?.[0]?.name ?? 'General COT', location: normalizeLocation(location) };
    },
  );

  const location = resource.data?.location ?? null;
  const address = location ? displayAddress(location) : '';
  const copyLocation = async () => {
    if (!location) return;
    const text = [address, location.landmark ? `Landmark: ${location.landmark}` : ''].filter(Boolean).join('\n');
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const openMap = async () => {
    if (!location) return;
    await Linking.openURL(googleMapsUrl(location));
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Location"
        kicker={scope === 'expression' ? 'EXPRESSION' : 'GENERAL COT'}
        subtitle={resource.data?.name ? `Official published location for ${resource.data.name}.` : 'Official published church location.'}
        showBack
        rightAction={scope === 'general' && generalAccess.canManageLeadership ? (
          <Button
            label={location ? 'Edit location' : 'Publish location'}
            variant="outline"
            size="sm"
            onPress={() => router.push({ pathname: '/general/church-story', params: { edit: 'location' } } as any)}
          />
        ) : undefined}
      />

      {resource.loading && !resource.data ? (
        <View style={styles.stack}><Skeleton height={150} borderRadius={radius.xl} /><Skeleton height={300} borderRadius={radius.xl} /></View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : !location ? (
        <EmptyState
          title="Location has not been published yet"
          message={scope === 'expression' ? 'An authorized Expression leader can add the official address in Expression Settings.' : 'An authorized General COT leader can publish the official church location from Our Story & Location.'}
          iconName="location-outline"
          actionLabel={scope === 'general' && generalAccess.canManageLeadership ? 'Publish location' : undefined}
          onAction={scope === 'general' && generalAccess.canManageLeadership
            ? () => router.push({ pathname: '/general/church-story', params: { edit: 'location' } } as any)
            : undefined}
        />
      ) : (
        <>
          <View style={[styles.addressCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.locationIcon, { backgroundColor: colors.primarySoft }]}><Icon name="location" size={23} color={colors.interactive} /></View>
            <View style={styles.flex}>
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>OFFICIAL LOCATION</Text>
              <Text style={[styles.address, { color: colors.text }]}>{address || 'Published map location'}</Text>
              {location.landmark ? <Text style={[styles.landmark, { color: colors.textSecondary }]}>Landmark: {location.landmark}</Text> : null}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={() => void copyLocation()} style={[styles.action, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]} accessibilityRole="button">
              <Icon name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.interactive} />
              <Text style={[styles.actionText, { color: colors.text }]}>{copied ? 'Copied' : 'Copy address'}</Text>
            </Pressable>
            <Pressable onPress={() => void openMap()} style={[styles.action, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]} accessibilityRole="button">
              <Icon name="navigate-outline" size={18} color={colors.interactive} />
              <Text style={[styles.actionText, { color: colors.interactive }]}>Open Google Maps</Text>
            </Pressable>
          </View>

          <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={styles.mapHeading}>
              <View style={styles.flex}><Text style={[styles.mapTitle, { color: colors.text }]}>Google Maps preview</Text><Text style={[styles.mapCopy, { color: colors.textMuted }]}>The map preview is intentionally limited to this precise Location screen.</Text></View>
              <Icon name="map-outline" size={21} color={colors.interactive} />
            </View>
            {Platform.OS === 'web' ? (
              <View style={styles.embedWrap}>
                {React.createElement('iframe' as any, {
                  src: googleEmbedUrl(location),
                  title: `${resource.data?.name ?? 'COT'} location map`,
                  width: '100%',
                  height: '320',
                  style: { border: 0, display: 'block', width: '100%', height: 320 },
                  loading: 'lazy',
                  referrerPolicy: 'no-referrer-when-downgrade',
                })}
              </View>
            ) : (
              <Pressable onPress={() => void openMap()} style={[styles.nativeMapPreview, { backgroundColor: colors.bgSecondary }]}>
                <Icon name="map" size={42} color={colors.interactive} />
                <Text style={[styles.nativeMapTitle, { color: colors.text }]}>Preview this location in Google Maps</Text>
                <Text style={[styles.nativeMapCopy, { color: colors.textSecondary }]}>Tap to open the exact published address or coordinates.</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  stack: { gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  addressCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  locationIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  address: { fontSize: 18, lineHeight: 25, fontWeight: '900', marginTop: 4 },
  landmark: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { minHeight: 44, flex: 1, minWidth: 160, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionText: { fontSize: 12, fontWeight: '800' },
  mapCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md, overflow: 'hidden' },
  mapHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mapTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  mapCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  embedWrap: { width: '100%', height: 320, borderRadius: radius.lg, overflow: 'hidden' },
  nativeMapPreview: { minHeight: 250, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  nativeMapTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', textAlign: 'center' },
  nativeMapCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 360 },
});
