import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export type UrgentHomeAnnouncement = {
  id: string;
  title: string;
  body: string;
  banner_url?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

type HomeEvent = {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  location?: string | null;
};

type DrawerData = {
  announcements: UrgentHomeAnnouncement[];
  events: HomeEvent[];
};

function shortDate(value?: string | null, includeTime = false) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, includeTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' });
}

export function UrgentUpdatesRail({ announcements }: { announcements: UrgentHomeAnnouncement[] }) {
  const { colors } = useTheme();
  const { auth, context, mode, hasOrganizationCapability } = useSession();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const canManage = mode === 'authenticated' && hasOrganizationCapability('announcements.manage');
  const [expanded, setExpanded] = React.useState(false);
  const [view, setView] = React.useState<'announcements' | 'events'>('announcements');

  const resource = useResource<DrawerData>(
    `general-home-context-drawer:${organizationId || 'none'}:${mode}:${expanded ? 'open' : 'closed'}`,
    async () => {
      if (!expanded || !organizationId) return { announcements, events: [] };
      const supabase = await getRuntimeSupabase(accessToken);
      const eventCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [announcementResult, eventResult] = await Promise.all([
        mode === 'authenticated'
          ? supabase
              .from('announcements')
              .select('id,title,body,banner_url,published_at,created_at')
              .eq('organization_id', organizationId)
              .is('branch_id', null)
              .eq('status', 'published')
              .order('published_at', { ascending: false, nullsFirst: false })
              .limit(8)
          : Promise.resolve({ data: announcements.slice(0, 8), error: null }),
        supabase
          .from('events')
          .select('id,title,description,starts_at,ends_at,location')
          .eq('organization_id', organizationId)
          .is('branch_id', null)
          .eq('status', 'published')
          .gte('ends_at', eventCutoff)
          .order('starts_at', { ascending: true })
          .limit(8),
      ]);
      if (eventResult.error && announcementResult.error) throw new Error('Unable to load announcements and events.');
      return {
        announcements: announcementResult.error ? announcements.slice(0, 8) : (announcementResult.data ?? []) as UrgentHomeAnnouncement[],
        events: eventResult.error ? [] : (eventResult.data ?? []) as HomeEvent[],
      };
    },
  );

  const drawerAnnouncements = resource.data?.announcements ?? announcements.slice(0, 8);
  const events = resource.data?.events ?? [];

  return (
    <View style={[
      styles.shell,
      expanded
        ? [styles.shellExpanded, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]
        : styles.shellCollapsed,
    ]}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={[styles.triggerIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
          <Icon name="notifications-outline" size={17} color={colors.interactive} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.triggerTitle, { color: colors.text }]}>Updates & gatherings</Text>
          {expanded ? <Text style={[styles.triggerCopy, { color: colors.textMuted }]}>Announcements and upcoming church events</Text> : null}
        </View>
        <View style={[styles.chevron, { backgroundColor: expanded ? colors.bgSecondary : colors.card }]}>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={[styles.expanded, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.toolbar}>
            <View style={[styles.segment, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <Pressable
                onPress={() => setView('announcements')}
                style={[styles.segmentButton, view === 'announcements' && { backgroundColor: colors.cardElevated }]}
              >
                <Icon name="megaphone-outline" size={14} color={view === 'announcements' ? colors.interactive : colors.textMuted} />
                <Text style={[styles.segmentText, { color: view === 'announcements' ? colors.text : colors.textMuted }]}>Announcements</Text>
              </Pressable>
              <Pressable
                onPress={() => setView('events')}
                style={[styles.segmentButton, view === 'events' && { backgroundColor: colors.cardElevated }]}
              >
                <Icon name="calendar-outline" size={14} color={view === 'events' ? colors.interactive : colors.textMuted} />
                <Text style={[styles.segmentText, { color: view === 'events' ? colors.text : colors.textMuted }]}>Events</Text>
              </Pressable>
            </View>
            {canManage ? (
              <Pressable
                onPress={() => router.push('/general/leadership/home-updates-manage' as any)}
                style={({ pressed }) => [styles.manageButton, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }, pressed && styles.pressed]}
              >
                <Icon name="options-outline" size={14} color={colors.interactive} />
                <Text style={[styles.manageText, { color: colors.interactive }]}>Home strip</Text>
              </Pressable>
            ) : null}
          </View>

          {resource.loading && !resource.data ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              <Skeleton width={260} height={150} borderRadius={radius.xl} count={2} />
            </ScrollView>
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : view === 'announcements' ? (
            <View style={styles.panel}>
              <View style={styles.panelHeading}>
                <View style={styles.flex}>
                  <Text style={[styles.panelEyebrow, { color: colors.live }]}>IMPORTANT UPDATES</Text>
                  <Text style={[styles.panelTitle, { color: colors.text }]}>What COT needs you to know</Text>
                </View>
                <Pressable onPress={() => router.push('/general/announcements' as any)} style={styles.viewAll}>
                  <Text style={[styles.viewAllText, { color: colors.interactive }]}>View all</Text>
                  <Icon name="arrow-forward" size={13} color={colors.interactive} />
                </Pressable>
              </View>
              {drawerAnnouncements.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {drawerAnnouncements.map((item, index) => (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push('/general/announcements' as any)}
                      style={({ pressed }) => [styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
                    >
                      {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.banner} resizeMode="cover" /> : null}
                      <View style={styles.cardTop}>
                        <View style={[styles.number, { backgroundColor: colors.primarySoft }]}><Text style={[styles.numberText, { color: colors.interactive }]}>{String(index + 1).padStart(2, '0')}</Text></View>
                        <Text style={[styles.date, { color: colors.textMuted }]}>{shortDate(item.published_at || item.created_at)}</Text>
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                      <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>{item.body}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : <Text style={[styles.emptyText, { color: colors.textMuted }]}>No General COT announcement is published right now.</Text>}
            </View>
          ) : (
            <View style={styles.panel}>
              <View style={styles.panelHeading}>
                <View style={styles.flex}>
                  <Text style={[styles.panelEyebrow, { color: colors.interactive }]}>UPCOMING</Text>
                  <Text style={[styles.panelTitle, { color: colors.text }]}>Events in General COT</Text>
                </View>
                <Pressable onPress={() => router.push('/general/events' as any)} style={styles.viewAll}>
                  <Text style={[styles.viewAllText, { color: colors.interactive }]}>View all</Text>
                  <Icon name="arrow-forward" size={13} color={colors.interactive} />
                </Pressable>
              </View>
              {events.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {events.map((event) => (
                    <Pressable
                      key={event.id}
                      onPress={() => router.push(`/general/event/${event.id}` as any)}
                      style={({ pressed }) => [styles.eventCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
                    >
                      <View style={[styles.eventDate, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.eventDateText, { color: colors.interactive }]}>{shortDate(event.starts_at)}</Text>
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
                      {event.description ? <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>{event.description}</Text> : null}
                      <View style={styles.eventFooter}>
                        <Icon name="time-outline" size={13} color={colors.textMuted} />
                        <Text style={[styles.eventMeta, { color: colors.textMuted }]}>{shortDate(event.starts_at, true)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : <Text style={[styles.emptyText, { color: colors.textMuted }]}>No General COT event is published right now.</Text>}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { overflow: 'hidden' },
  shellCollapsed: { alignSelf: 'flex-start', borderRadius: radius.pill },
  shellExpanded: { width: '100%', borderWidth: 1, borderRadius: radius.xl },
  trigger: { minHeight: 46, paddingHorizontal: spacing.xs, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 7 },
  triggerIcon: { width: 36, height: 36, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 1 },
  triggerTitle: { fontSize: 11.5, lineHeight: 16, fontWeight: '900', letterSpacing: -0.1 },
  triggerCopy: { fontSize: 9.5, lineHeight: 14, marginTop: 1 },
  chevron: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  expanded: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, paddingTop: spacing.sm, gap: spacing.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, padding: 3, gap: 2 },
  segmentButton: { minHeight: 34, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentText: { fontSize: 10, fontWeight: '900' },
  manageButton: { minHeight: 34, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  manageText: { fontSize: 9.5, fontWeight: '900' },
  panel: { gap: spacing.sm },
  panelHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  panelEyebrow: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 },
  panelTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.3, marginTop: 1 },
  viewAll: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontSize: 9.5, fontWeight: '900' },
  rail: { gap: spacing.sm, paddingRight: spacing.md, paddingBottom: 2 },
  card: { width: 265, minHeight: 146, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 7, overflow: 'hidden' },
  banner: { width: '100%', aspectRatio: 16 / 7, borderRadius: radius.md, marginBottom: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { minWidth: 31, height: 23, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  numberText: { fontSize: 9, fontWeight: '900' },
  date: { fontSize: 9.5, fontWeight: '700' },
  cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  body: { fontSize: 10.8, lineHeight: 16 },
  eventCard: { width: 250, minHeight: 138, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 8 },
  eventDate: { alignSelf: 'flex-start', minHeight: 27, borderRadius: radius.pill, paddingHorizontal: 9, justifyContent: 'center' },
  eventDateText: { fontSize: 9.5, fontWeight: '900' },
  eventFooter: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
  eventMeta: { fontSize: 9.5, fontWeight: '700' },
  emptyText: { fontSize: 11, lineHeight: 17, paddingVertical: spacing.sm },
  pressed: { opacity: 0.78, transform: [{ scale: 0.988 }] },
});
