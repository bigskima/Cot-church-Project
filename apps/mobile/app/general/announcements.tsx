import React from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Announcement = {
  id: string;
  title: string;
  body: string;
  banner_url?: string | null;
  response_form_id?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};
type LinkedForm = { id: string; slug: string; title: string; status: string };

function dateLabel(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: parsed.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export default function GeneralAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const { auth, context, mode, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const canManage = mode === 'authenticated' && hasOrganizationCapability('announcements.manage');

  const resource = useResource<Announcement[]>(
    `general:announcements:${organizationId || 'none'}:${mode}`,
    async () => {
      if (mode !== 'authenticated' || !organizationId) return [];
      const supabase = await getRuntimeSupabase(accessToken);
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,body,banner_url,response_form_id,published_at,created_at')
        .eq('organization_id', organizationId)
        .is('branch_id', null)
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw new Error(error.message || 'Unable to load announcements.');
      return (data ?? []) as Announcement[];
    },
  );

  const announcements = resource.data ?? [];
  const latest = announcements[0];
  const remaining = announcements.slice(1);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 90 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
    >
      <ScreenHeader
        title="Announcements"
        kicker="GENERAL COT"
        subtitle="Church-wide notices and important public community updates."
        showBack
        rightAction={canManage ? <Button label="Manage" size="sm" variant="secondary" onPress={() => router.push('/general/leadership/announcements-manage' as any)} /> : undefined}
      />

      {mode !== 'authenticated' ? (
        <EmptyState
          title="Sign in to view announcements"
          message="General COT announcements follow the church's current member visibility policy."
          iconName="lock-closed-outline"
        />
      ) : resource.loading && !resource.data ? (
        <View style={styles.stack}><Skeleton height={118} count={4} /></View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : latest ? (
        <>
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="megaphone-outline" size={20} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>{announcements.length} published update{announcements.length === 1 ? '' : 's'}</Text>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Only General COT announcements are shown here.</Text>
            </View>
          </View>

          <Text style={[styles.eyebrow, { color: colors.interactive }]}>LATEST</Text>
          <View style={[styles.featured, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm]}>
            {latest.banner_url ? <Image source={{ uri: latest.banner_url }} style={styles.banner} resizeMode="cover" /> : null}
            <Text style={[styles.title, { color: colors.text }]}>{latest.title}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{dateLabel(latest.published_at ?? latest.created_at)}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{latest.body}</Text>
            {latest.response_form_id ? <AnnouncementFormAction formId={latest.response_form_id} organizationId={organizationId} /> : null}
          </View>

          {remaining.length ? (
            <View style={styles.stack}>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>EARLIER</Text>
              {remaining.map((item) => (
                <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                  {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.cardBanner} resizeMode="cover" /> : null}
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{dateLabel(item.published_at ?? item.created_at)}</Text>
                  <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
                  {item.response_form_id ? <AnnouncementFormAction formId={item.response_form_id} organizationId={organizationId} /> : null}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No announcements yet"
          message="Published General COT announcements will appear here."
          iconName="megaphone-outline"
          actionLabel={canManage ? 'Create announcement' : undefined}
          onAction={canManage ? () => router.push('/general/leadership/announcements-manage' as any) : undefined}
        />
      )}
    </ScrollView>
  );
}

function AnnouncementFormAction({ formId, organizationId }: { formId: string; organizationId: string }) {
  const { api } = useSession();
  const { colors } = useTheme();
  const form = useResource<LinkedForm | null>(
    'announcement:form:' + formId,
    (signal) => api.request<LinkedForm>(
      'noop?service=engagement-hub&action=form&id=' + encodeURIComponent(formId) + '&organizationId=' + encodeURIComponent(organizationId),
      { signal, context: 'public' },
    ).catch(() => null),
  );
  if (!form.data) return null;
  return (
    <Button
      label={form.data.title || 'Respond'}
      variant="outline"
      size="sm"
      onPress={() => router.push(('/general/forms/' + form.data!.slug) as any)}
      icon={<Icon name="document-text-outline" size={16} color={colors.interactive} />}
      style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
    />
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  flex: { flex: 1 },
  stack: { gap: spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  summaryText: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  featured: { borderWidth: 1.5, borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden' },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, overflow: 'hidden' },
  banner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, marginBottom: spacing.md },
  cardBanner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, marginBottom: spacing.sm },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '900' },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  meta: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  body: { fontSize: 13, lineHeight: 21, marginTop: spacing.sm },
});
