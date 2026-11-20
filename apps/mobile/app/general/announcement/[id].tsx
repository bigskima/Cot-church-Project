import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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

type LinkedForm = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

function dateLabel(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function GeneralAnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const announcementId = typeof id === 'string' ? id : '';
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, auth, context, mode, hasOrganizationCapability } = useSession();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const canManage = mode === 'authenticated' && hasOrganizationCapability('announcements.manage');

  const resource = useResource<Announcement | null>(
    'general:announcement:' + announcementId + ':' + organizationId + ':' + mode,
    async () => {
      if (mode !== 'authenticated' || !organizationId || !announcementId) return null;
      const supabase = await getRuntimeSupabase(accessToken);
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,body,banner_url,response_form_id,published_at,created_at')
        .eq('id', announcementId)
        .eq('organization_id', organizationId)
        .is('branch_id', null)
        .eq('status', 'published')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Unable to load this announcement.');
      return (data ?? null) as Announcement | null;
    },
  );

  const form = useResource<LinkedForm | null>(
    'general:announcement:form:' + (resource.data?.response_form_id ?? 'none'),
    (signal) => resource.data?.response_form_id && organizationId
      ? api.request<LinkedForm>(
          'noop?service=engagement-hub&action=form&id=' + encodeURIComponent(resource.data.response_form_id) + '&organizationId=' + encodeURIComponent(organizationId),
          { signal, context: 'public' },
        ).catch(() => null)
      : Promise.resolve(null),
  );

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.state, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <EmptyState title="Sign in to read this announcement" message="General COT announcements follow the church's current member visibility policy." iconName="lock-closed-outline" />
        <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/announcement/' + announcementId } } as any)} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 110 }]}
      >
        <ScreenHeader
          title="Announcement"
          kicker="GENERAL COT"
          subtitle="Official church update"
          showBack
          rightAction={canManage ? <Button label="Manage" size="sm" variant="outline" onPress={() => router.push('/general/leadership/announcements-manage' as any)} /> : undefined}
        />

        {resource.loading && !resource.data ? (
          <><Skeleton height={210} borderRadius={radius.xl} /><Skeleton height={70} count={4} /></>
        ) : resource.error ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : !resource.data ? (
          <EmptyState title="Announcement unavailable" message="This announcement may have been unpublished, removed, or is no longer available." iconName="megaphone-outline" />
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            {resource.data.banner_url ? <Image source={{ uri: resource.data.banner_url }} style={styles.banner} resizeMode="cover" /> : null}
            <View style={styles.body}>
              <View style={styles.headingRow}>
                <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Icon name="megaphone-outline" size={20} color={colors.interactive} /></View>
                <View style={styles.flex}>
                  <Text style={[styles.title, { color: colors.text }]}>{resource.data.title}</Text>
                  <Text style={[styles.date, { color: colors.textMuted }]}>{dateLabel(resource.data.published_at ?? resource.data.created_at)}</Text>
                </View>
              </View>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>{resource.data.body}</Text>
              {form.data ? (
                <Button
                  label={form.data.title || 'Respond'}
                  size="lg"
                  onPress={() => router.push(('/general/forms/' + form.data!.slug) as any)}
                  icon={<Icon name="document-text-outline" size={18} color={colors.textInverse} />}
                />
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  banner: { width: '100%', aspectRatio: 16 / 7 },
  body: { padding: spacing.lg, gap: spacing.lg },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '900', letterSpacing: -0.45 },
  date: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  copy: { fontSize: 14, lineHeight: 23 },
});
