import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, EmptyState, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { PLATFORM_MODULES, type PlatformModule } from './PlatformAdministrationHub';
import { hasPlatformPermission, isPlatformSuperAdmin, usePlatformAdministrationContext } from './usePlatformAdministration';

type UnknownRecord = Record<string, unknown>;

function displayLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function primitiveText(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function RowPreview({ value, index }: { value: unknown; index: number }) {
  const { colors } = useTheme();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.itemTitle, { color: colors.text }]}>Item {index + 1}</Text><Text style={[styles.itemValue, { color: colors.textSecondary }]}>{primitiveText(value) || 'Structured value'}</Text></View>;
  }
  const entries = Object.entries(value as UnknownRecord);
  const titleEntry = entries.find(([key, item]) => ['name', 'title', 'display_name', 'email', 'key', 'code', 'id'].includes(key) && (typeof item === 'string' || typeof item === 'number'));
  const primitives = entries.filter(([, item]) => item === null || ['string', 'number', 'boolean'].includes(typeof item)).slice(0, 7);
  const nested = entries.filter(([, item]) => typeof item === 'object' && item !== null).slice(0, 3);
  return (
    <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
      <View style={styles.itemHeading}><Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{titleEntry ? String(titleEntry[1]) : `Record ${index + 1}`}</Text><Badge label="LIVE" variant="neutral" /></View>
      {primitives.map(([key, item]) => <View key={key} style={styles.dataRow}><Text style={[styles.dataLabel, { color: colors.textMuted }]}>{displayLabel(key)}</Text><Text style={[styles.dataValue, { color: colors.textSecondary }]} numberOfLines={3}>{primitiveText(item)}</Text></View>)}
      {nested.map(([key, item]) => <View key={key} style={styles.dataRow}><Text style={[styles.dataLabel, { color: colors.textMuted }]}>{displayLabel(key)}</Text><Text style={[styles.dataValue, { color: colors.textSecondary }]}>{Array.isArray(item) ? `${item.length} item${item.length === 1 ? '' : 's'}` : `${Object.keys(item as UnknownRecord).length} fields`}</Text></View>)}
    </View>
  );
}

function DataPreview({ value }: { value: unknown }) {
  const { colors } = useTheme();
  if (Array.isArray(value)) {
    return <View style={styles.list}>{value.length ? value.slice(0, 30).map((item, index) => <RowPreview key={(item as any)?.id ?? (item as any)?.key ?? index} value={item} index={index} />) : <EmptyState title="No records returned" message="The live endpoint returned an empty list." iconName="file-tray-outline" />}{value.length > 30 ? <Text style={[styles.limitNote, { color: colors.textMuted }]}>Showing the first 30 of {value.length} records.</Text> : null}</View>;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as UnknownRecord);
    const arrays = entries.filter(([, item]) => Array.isArray(item));
    const primitives = entries.filter(([, item]) => item === null || ['string', 'number', 'boolean'].includes(typeof item));
    const objects = entries.filter(([, item]) => item && typeof item === 'object' && !Array.isArray(item));
    return <View style={styles.list}>
      {primitives.length ? <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>{primitives.map(([key, item]) => <View key={key} style={styles.dataRow}><Text style={[styles.dataLabel, { color: colors.textMuted }]}>{displayLabel(key)}</Text><Text style={[styles.dataValue, { color: colors.textSecondary }]}>{primitiveText(item)}</Text></View>)}</View> : null}
      {arrays.map(([key, items]) => <View key={key} style={styles.group}><View style={styles.groupHeading}><Text style={[styles.groupTitle, { color: colors.text }]}>{displayLabel(key)}</Text><Badge label={String((items as unknown[]).length)} variant="neutral" /></View>{(items as unknown[]).slice(0, 20).map((item, index) => <RowPreview key={(item as any)?.id ?? (item as any)?.key ?? index} value={item} index={index} />)}{(items as unknown[]).length > 20 ? <Text style={[styles.limitNote, { color: colors.textMuted }]}>Showing the first 20 records in this section.</Text> : null}</View>)}
      {objects.map(([key, item]) => <View key={key} style={styles.group}><Text style={[styles.groupTitle, { color: colors.text }]}>{displayLabel(key)}</Text><RowPreview value={item} index={0} /></View>)}
      {!entries.length ? <EmptyState title="No data returned" message="The live endpoint returned an empty object." iconName="file-tray-outline" /> : null}
    </View>;
  }
  return <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.itemValue, { color: colors.textSecondary }]}>{primitiveText(value)}</Text></View>;
}

export default function PlatformAdministrationModuleExperience() {
  const { module: moduleParam } = useLocalSearchParams<{ module?: string }>();
  const moduleKey = Array.isArray(moduleParam) ? moduleParam[0] : moduleParam;
  const module = PLATFORM_MODULES.find((item) => item.key === moduleKey);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, mode } = useSession();
  const authority = usePlatformAdministrationContext();
  const allowed = Boolean(module && authority.data && (!module.superAdminOnly || isPlatformSuperAdmin(authority.data)) && hasPlatformPermission(authority.data, module.permission));
  const data = useResource<unknown>(`platform:mobile-module:${module?.key ?? 'missing'}:${mode}`, async (signal) => {
    if (!module || !allowed) return null;
    return api.request<unknown>(module.endpoint, { signal });
  });
  const canUseRelated = Boolean(module?.relatedRoute);
  const livePermission = module ? hasPlatformPermission(authority.data, module.permission) : false;
  const permissionState = useMemo(() => module ? `${module.permission}${isPlatformSuperAdmin(authority.data) ? ' · super admin override' : ''}` : '', [authority.data, module]);

  if (!module) {
    return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Unknown administration section" message="This Platform Administration route is not registered in the mobile workspace." iconName="alert-circle-outline" /><Button label="Back to Platform Administration" onPress={() => router.replace('/general/leadership/platform-admin' as any)} /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]} accessibilityRole="button" accessibilityLabel="Back to Platform Administration"><Icon name="arrow-back" size={19} color={colors.text} /></Pressable>
          <View style={styles.flex}><Text style={[styles.eyebrow, { color: colors.interactive }]}>{module.group.toUpperCase()}</Text><Text style={[styles.title, { color: colors.text }]}>{module.title}</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>{module.description}</Text></View>
        </View>

        {authority.loading ? <Skeleton height={110} count={3} /> : !authority.data || !livePermission || !allowed ? <EmptyState title="This administration section is unavailable" message="Your current Platform Administration role does not grant this section." iconName="lock-closed-outline" /> : (
          <>
            <View style={[styles.accessCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={18} color={colors.interactive} /><View style={styles.flex}><Text style={[styles.accessTitle, { color: colors.text }]}>Live permission confirmed</Text><Text style={[styles.accessCopy, { color: colors.textMuted }]}>{permissionState}</Text></View></View>

            {canUseRelated ? <Pressable onPress={() => router.push(module.relatedRoute as any)} style={({ pressed }) => [styles.relatedCard, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm, pressed && styles.pressed]}><View style={[styles.relatedIcon, { backgroundColor: colors.primarySoft }]}><Icon name="open-outline" size={19} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.relatedTitle, { color: colors.text }]}>Open related COT control</Text><Text style={[styles.relatedCopy, { color: colors.textMuted }]}>Continue into the existing native management workflow without leaving the app.</Text></View><Icon name="arrow-forward" size={16} color={colors.interactive} /></Pressable> : null}

            <View style={styles.sectionHeading}><View style={styles.flex}><Text style={[styles.sectionTitle, { color: colors.text }]}>Operational snapshot</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Loaded directly from the same backend contract used by Platform Administration.</Text></View><Button label="Refresh" variant="outline" size="sm" onPress={data.refresh} loading={data.refreshing} /></View>

            {data.loading && data.data === undefined ? <Skeleton height={104} count={4} /> : data.error && data.data === undefined ? <ResourceError message={data.error} retry={data.refresh} /> : <DataPreview value={data.data} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 }, header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, backButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.05 }, title: { fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.7, marginTop: 2 }, subtitle: { fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  accessCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, accessTitle: { fontSize: 12, fontWeight: '900' }, accessCopy: { fontSize: 9.5, lineHeight: 14, marginTop: 2 }, relatedCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, relatedIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, relatedTitle: { fontSize: 13.5, fontWeight: '900' }, relatedCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' }, sectionCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 }, list: { gap: spacing.sm }, group: { gap: spacing.sm }, groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 }, groupTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  summaryCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 8 }, itemCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 7 }, itemHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 }, itemTitle: { flex: 1, fontSize: 13, fontWeight: '900' }, itemValue: { fontSize: 11, lineHeight: 16 }, dataRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, dataLabel: { width: 125, fontSize: 9.5, lineHeight: 14, fontWeight: '800' }, dataValue: { flex: 1, fontSize: 10.5, lineHeight: 15, textAlign: 'right' }, limitNote: { fontSize: 9.5, lineHeight: 14, textAlign: 'center' }, pressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
});