import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
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

export default function EventDetailScreen() {
  const { id, context: requestedContext } = useLocalSearchParams<{ id: string; context?: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [registering, setRegistering] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const expressionMode = requestedContext === 'expression';

  const resource = useResource<Event>(`event:detail:${expressionMode ? context?.expression?.id ?? 'none' : 'public'}:${id}`, (signal) => {
    if (expressionMode) {
      if (mode === 'visitor' || !context?.expression?.id) {
        return Promise.reject(new Error('Enter this Expression to view its internal event.'));
      }
      return api.request<Event>(`events?id=${id}`, { signal });
    }
    return api.request<Event>(`public-content?type=event&id=${id}`, { signal, context: 'public' });
  });

  const event = resource.data;
  const registrations = useResource<EventRegistration[]>(`event:registration:${mode}:${id}`, (signal) =>
    mode === 'authenticated'
      ? api.request<EventRegistration[]>(`event-registrations?eventId=${id}`, { signal })
      : Promise.resolve([]),
  );
  const registration = registrations.data?.find((item) => item.status !== 'cancelled');

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
      router.push({
        pathname: '/(auth)/login',
        params: { returnTo: `/event/${id}${expressionMode ? '?context=expression' : ''}` },
      } as any);
      return;
    }
    setRegistering(true);
    setActionError('');
    setActionMessage('');
    try {
      const result = await api.request<EventRegistration>('event-registrations', {
        method: 'POST',
        body: JSON.stringify({ eventId: id }),
      });
      setActionMessage(result.status === 'waitlisted' ? 'You joined the waitlist.' : 'Your registration is confirmed.');
      registrations.refresh();
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to complete event registration.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancel = async () => {
    setRegistering(true);
    setActionError('');
    setActionMessage('');
    try {
      await api.request('event-registrations', { method: 'DELETE', body: JSON.stringify({ eventId: id }) });
      setActionMessage('Your registration has been cancelled.');
      registrations.refresh();
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to cancel registration.');
    } finally {
      setRegistering(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Join us for ${event.title}! ${event.location?.name ? `At ${event.location.name}` : ''}`,
      });
    } catch {
      // Ignored
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]}
      >
        <ScreenHeader
          title={event?.title ?? 'Event'}
          kicker="EVENT"
          subtitle={event?.location?.name ?? undefined}
          showBack
        />

        {resource.loading ? (
          <View style={styles.body}>
            <Skeleton height={140} borderRadius={radius.lg} />
            <Skeleton height={80} count={2} borderRadius={radius.md} />
          </View>
        ) : resource.error && !event ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : event ? (
          <View style={styles.body}>
            {/* Event Time & Location Card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="calendar-outline" size={20} color={colors.interactive} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardLabel, { color: colors.textMuted }]}>DATE & TIME</Text>
                  <Text style={[styles.cardValue, { color: colors.text }]}>
                    {event.starts_at ? new Date(event.starts_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'To Be Announced'}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="location-outline" size={20} color={colors.interactive} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardLabel, { color: colors.textMuted }]}>VENUE LOCATION</Text>
                  <Text style={[styles.cardValue, { color: colors.text }]}>
                    {event.location?.name || 'Location to be announced'}
                  </Text>
                  {event.location?.is_online && (
                    <Badge label="HYBRID & ONLINE STREAM" variant="primary" style={{ marginTop: 4, alignSelf: 'flex-start' }} />
                  )}
                </View>
              </View>
            </View>

            {/* Description */}
            {event.description ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <Text style={[styles.cardKicker, { color: colors.interactive }]}>ABOUT THIS GATHERING</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>{event.description}</Text>
              </View>
            ) : null}

            {/* Actions Bar */}
            {registrations.loading && mode === 'authenticated' ? <Skeleton height={48} borderRadius={radius.md} /> : null}
            {registrations.error && mode === 'authenticated' ? <ResourceError message={registrations.error} retry={registrations.refresh} /> : null}
            {registration ? (
              <View style={[styles.registrationState, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}>
                <Icon name="checkmark-circle" size={20} color={colors.interactive} />
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardValue, { color: colors.text }]}>{registration.status === 'waitlisted' ? 'You are on the waitlist' : registration.status === 'attended' ? 'Attendance recorded' : 'You are registered'}</Text>
                  <Text style={[styles.registrationHint, { color: colors.textSecondary }]}>{registration.status === 'waitlisted' ? 'Your place may be confirmed if capacity becomes available.' : 'Your registration is saved to your account.'}</Text>
                </View>
              </View>
            ) : null}
            {actionError ? <Text style={[styles.statusMessage, { color: colors.live }]} accessibilityRole="alert">{actionError}</Text> : null}
            {actionMessage ? <Text style={[styles.statusMessage, { color: colors.success }]} accessibilityRole="alert">{actionMessage}</Text> : null}
            <View style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <Button
                label={registration && registration.status !== 'attended' ? 'Cancel Registration' : registration?.status === 'attended' ? 'Attendance Recorded' : registrationAvailability.label}
                onPress={registration && registration.status !== 'attended' ? handleCancel : handleRegister}
                loading={registering}
                disabled={registration?.status === 'attended' || (!registration && !registrationAvailability.allowed)}
                variant={registration ? 'outline' : 'primary'}
                size="lg"
                style={{ flex: 1 }}
                icon={<Icon name={registration ? 'checkmark-circle' : 'ticket-outline'} size={18} color={registration ? colors.interactive : colors.textInverse} />}
              />
              <Button
                label="Share"
                onPress={handleShare}
                variant="outline"
                size="lg"
                icon={<Icon name="share-outline" size={18} color={colors.text} />}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  cardKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
  },
  statusMessage: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  registrationState: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  registrationHint: { fontSize: 12, lineHeight: 17 },
});
