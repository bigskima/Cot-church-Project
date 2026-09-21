import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { shareContent } from '@/services/share';
import {
  Badge,
  Button,
  EventLiveCountdown,
  Icon,
  ResourceError,
  ScreenHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Event } from '@/types/content';

type EventRegistration = {
  id: string;
  event_id: string;
  occurrence_id?: string | null;
  status: 'registered' | 'waitlisted' | 'cancelled' | 'attended';
  registered_at: string;
};

type EventWithBanner = Event & { banner_url?: string | null };
type EventInterest = { interested: boolean };
type LinkedForm = { id: string; slug: string; title: string; status: string; requires_auth?: boolean };

export function EventDetailScreen({ forcedScope }: { forcedScope?: 'general' | 'expression' } = {}) {
  const { id, context: requestedContext } = useLocalSearchParams<{ id: string; context?: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [registering, setRegistering] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const expressionMode = forcedScope ? forcedScope === 'expression' : requestedContext === 'expression';

  const resource = useResource<EventWithBanner>(`event:detail:${expressionMode ? context?.expression?.id ?? 'none' : 'public'}:${id}`, async (signal) => {
    if (expressionMode) {
      if (mode === 'visitor' || !context?.expression?.id) throw new Error('Enter this Expression to view its internal event.');
      return api.request<EventWithBanner>(`events?id=${id}`, { signal });
    }

    // Keep the canonical public-content event contract as the source of truth.
    // The small detail endpoint only enriches older deployments that do not yet
    // expose the banner field through public-content.
    const event = await api.request<EventWithBanner>(`public-content?type=event&id=${id}`, { signal, context: 'public' });
    if (event.banner_url) return event;
    try {
      const enriched = await api.request<EventWithBanner>(`public-event-detail?id=${id}`, { signal, context: 'public' });
      return { ...event, banner_url: enriched.banner_url ?? null };
    } catch {
      return event;
    }
  });

  const event = resource.data;
  const registrations = useResource<EventRegistration[]>(`event:registration:${mode}:${id}`, (signal) =>
    mode === 'authenticated'
      ? api.request<EventRegistration[]>(`event-registrations?eventId=${id}`, { signal })
      : Promise.resolve([]),
  );
  const registration = registrations.data?.find((item) => item.status !== 'cancelled');

  const interest = useResource<EventInterest>(
    `event:interest:${mode}:${id}:${event?.organization_id ?? 'none'}`,
    (signal) => mode === 'authenticated' && event?.organization_id
      ? api.request<EventInterest>(
          'noop?service=engagement-hub&action=event_interest&eventId=' + encodeURIComponent(String(id)) + '&organizationId=' + encodeURIComponent(event.organization_id),
          { signal },
        )
      : Promise.resolve({ interested: false }),
  );
  const linkedForm = useResource<LinkedForm | null>(
    `event:response-form:${event?.response_form_id ?? 'none'}`,
    (signal) => event?.response_form_id && event?.organization_id
      ? api.request<LinkedForm>(
          'noop?service=engagement-hub&action=form&id=' + encodeURIComponent(event.response_form_id) + '&organizationId=' + encodeURIComponent(event.organization_id),
          { signal, context: 'public' },
        ).catch(() => null)
      : Promise.resolve(null),
  );
  const [interestBusy, setInterestBusy] = useState(false);

  const registrationAvailability = (() => {
    if (!event) return { allowed: false, label: 'RSVP / Register' };
    const now = Date.now();
    if (event.ends_at && Date.parse(event.ends_at) <= now) return { allowed: false, label: 'Event Ended' };
    if (event.registration_opens_at && Date.parse(event.registration_opens_at) > now) return { allowed: false, label: 'Registration Not Open' };
    if (event.registration_closes_at && Date.parse(event.registration_closes_at) < now) return { allowed: false, label: 'Registration Closed' };
    return { allowed: true, label: 'RSVP / Register' };
  })();

  const handleRegister = async () => {
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: forcedScope === 'general' ? `/general/event/${id}` : `/event/${id}${expressionMode ? '?context=expression' : ''}` } } as any);
      return;
    }
    setRegistering(true); setActionError(''); setActionMessage('');
    try {
      const result = await api.request<EventRegistration>('event-registrations', { method: 'POST', body: JSON.stringify({ eventId: id }) });
      setActionMessage(result.status === 'waitlisted' ? 'You joined the waitlist.' : 'Your registration is confirmed.');
      registrations.refresh();
    } catch (value) { setActionError(value instanceof Error ? value.message : 'Unable to complete event registration.'); }
    finally { setRegistering(false); }
  };

  const handleCancel = async () => {
    setRegistering(true); setActionError(''); setActionMessage('');
    try {
      await api.request('event-registrations', { method: 'DELETE', body: JSON.stringify({ eventId: id }) });
      setActionMessage('Your registration has been cancelled.'); registrations.refresh();
    } catch (value) { setActionError(value instanceof Error ? value.message : 'Unable to cancel registration.'); }
    finally { setRegistering(false); }
  };

  const handleInterest = async () => {
    if (!event) return;
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: forcedScope === 'general' ? `/general/event/${id}` : `/event/${id}${expressionMode ? '?context=expression' : ''}` } } as any);
      return;
    }
    setInterestBusy(true); setActionError(''); setActionMessage('');
    const nextInterested = !interest.data?.interested;
    try {
      await api.request('noop?service=engagement-hub', {
        method: 'POST',
        body: JSON.stringify({ action: 'event_interest', organizationId: event.organization_id, eventId: id, interested: nextInterested }),
      });
      setActionMessage(nextInterested ? 'Saved to your interested events.' : 'Removed from your interested events.');
      interest.refresh();
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to save your interest.');
    } finally {
      setInterestBusy(false);
    }
  };

  const handleShare = async () => {
    if (!event || expressionMode) return;
    const message = `Join us for ${event.title}!${event.location?.name ? ` At ${event.location.name}.` : ''}`;
    try { await shareContent({ title: event.title, message, attachment: event.banner_url ? { url: event.banner_url, mimeType: 'image/jpeg' } : null }); } catch {}
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]}>
        <ScreenHeader title={event?.title ?? 'Event'} kicker="EVENT" subtitle={event?.location?.name ?? undefined} showBack />
        {resource.loading ? <View style={styles.body}><Skeleton height={210} borderRadius={radius.lg} /><Skeleton height={80} count={2} borderRadius={radius.md} /></View> : resource.error && !event ? <ResourceError message={resource.error} retry={resource.refresh} /> : event ? (
          <View style={styles.body}>
            {event.banner_url ? <View style={[styles.bannerFrame, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, shadows.md]}><Image source={{ uri: event.banner_url }} style={styles.bannerImage} resizeMode="cover" accessibilityLabel={`${event.title} event banner`} /></View> : null}
            <EventLiveCountdown startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} />
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={styles.cardRow}><View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}><Icon name="calendar-outline" size={20} color={colors.interactive} /></View><View style={styles.cardInfo}><Text style={[styles.cardLabel, { color: colors.textMuted }]}>DATE & TIME</Text><Text style={[styles.cardValue, { color: colors.text }]}>{event.starts_at ? new Date(event.starts_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'To Be Announced'}</Text>{event.ends_at ? <Text style={[styles.timeHint, { color: colors.textSecondary }]}>Ends {new Date(event.ends_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}</View></View>
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
              <View style={styles.cardRow}><View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}><Icon name="location-outline" size={20} color={colors.interactive} /></View><View style={styles.cardInfo}><Text style={[styles.cardLabel, { color: colors.textMuted }]}>VENUE LOCATION</Text><Text style={[styles.cardValue, { color: colors.text }]}>{event.location?.name || 'Location to be announced'}</Text>{event.location?.is_online ? <Badge label="HYBRID & ONLINE STREAM" variant="primary" style={{ marginTop: 4, alignSelf: 'flex-start' }} /> : null}</View></View>
            </View>
            {event.description ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}><Text style={[styles.cardKicker, { color: colors.interactive }]}>ABOUT THIS GATHERING</Text><Text style={[styles.bodyText, { color: colors.text }]}>{event.description}</Text></View> : null}
            {registrations.loading && mode === 'authenticated' ? <Skeleton height={48} borderRadius={radius.md} /> : null}
            {registrations.error && mode === 'authenticated' ? <ResourceError message={registrations.error} retry={registrations.refresh} /> : null}
            {registration ? <View style={[styles.registrationState, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}><Icon name="checkmark-circle" size={20} color={colors.interactive} /><View style={styles.cardInfo}><Text style={[styles.cardValue, { color: colors.text }]}>{registration.status === 'waitlisted' ? 'You are on the waitlist' : registration.status === 'attended' ? 'Attendance recorded' : 'You are registered'}</Text><Text style={[styles.registrationHint, { color: colors.textSecondary }]}>{registration.status === 'waitlisted' ? 'Your place may be confirmed if capacity becomes available.' : 'Your registration is saved to your account.'}</Text></View></View> : null}
            {actionError ? <Text style={[styles.statusMessage, { color: colors.live }]} accessibilityRole="alert">{actionError}</Text> : null}
            {actionMessage ? <Text style={[styles.statusMessage, { color: colors.success }]} accessibilityRole="alert">{actionMessage}</Text> : null}
            <View style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <Button label={registration && registration.status !== 'attended' ? 'Cancel Registration' : registration?.status === 'attended' ? 'Attendance Recorded' : registrationAvailability.label} onPress={registration && registration.status !== 'attended' ? handleCancel : handleRegister} loading={registering} disabled={registration?.status === 'attended' || (!registration && !registrationAvailability.allowed)} variant={registration ? 'outline' : 'primary'} size="lg" style={{ flex: 1 }} icon={<Icon name={registration ? 'checkmark-circle' : 'ticket-outline'} size={18} color={registration ? colors.interactive : colors.textInverse} />} />
              {!expressionMode ? <Button label="Share" onPress={handleShare} variant="outline" size="lg" icon={<Icon name="share-outline" size={18} color={colors.text} />} /> : null}
            </View>
            <View style={styles.responseActions}>
              <Button
                label={interest.data?.interested ? 'Interested ✓' : 'I’m interested'}
                onPress={() => void handleInterest()}
                loading={interestBusy}
                variant={interest.data?.interested ? 'secondary' : 'outline'}
                size="lg"
                style={{ flex: 1 }}
                icon={<Icon name={interest.data?.interested ? 'heart' : 'heart-outline'} size={18} color={colors.interactive} />}
              />
              {linkedForm.data ? (
                <Button
                  label={linkedForm.data.title || 'Event form'}
                  onPress={() => router.push(('/general/forms/' + linkedForm.data!.slug) as any)}
                  variant="outline"
                  size="lg"
                  style={{ flex: 1 }}
                  icon={<Icon name="document-text-outline" size={18} color={colors.interactive} />}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function LegacyEventDetailRoute() {
  const { id, context: requestedContext } = useLocalSearchParams<{ id?: string; context?: string }>();
  if (requestedContext === 'expression') return <Redirect href="/expressions" />;
  return <Redirect href={`/general/event/${typeof id === 'string' ? id : ''}` as any} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, responseActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, bannerFrame: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' }, bannerImage: { width: '100%', height: '100%' }, card: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md }, cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, cardInfo: { flex: 1, gap: 2 }, cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }, cardValue: { fontSize: 15, fontWeight: '600' }, timeHint: { marginTop: 3, fontSize: 12, lineHeight: 17, fontWeight: '500' }, divider: { height: 1, width: '100%' }, cardKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }, bodyText: { fontSize: 14, lineHeight: 22 }, actionRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xxl, borderWidth: 1 }, statusMessage: { fontSize: 13, lineHeight: 18, fontWeight: '600' }, registrationState: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, registrationHint: { fontSize: 12, lineHeight: 17 },
});
