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

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode } = useSession();
  const { colors } = useTheme();

  const [registered, setRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);

  const resource = useResource<Event>(`event:detail:${id}`, (signal) => {
    if (mode === 'visitor') {
      return api
        .request<Event[]>(`public-content?type=events`, { signal })
        .then((list) => {
          const match = list.find((e) => e.id === id);
          if (!match) throw new Error('Event not found.');
          return match;
        });
    }
    return api.request<Event>(`events?id=${id}`, { signal });
  });

  const event = resource.data;

  const handleRegister = async () => {
    if (mode === 'visitor') {
      router.push('/(auth)/login');
      return;
    }
    setRegistering(true);
    try {
      await api.request('event-registrations', {
        method: 'POST',
        body: JSON.stringify({ eventId: id }),
      });
      setRegistered(true);
    } catch {
      alert('Unable to complete event registration.');
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
      >
        <ScreenHeader
          title={event?.title ?? 'Church Gathering'}
          subtitle={event?.location?.name ?? 'Worship service & fellowship'}
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
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
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
                    {event.location?.name || 'Sanctuary Campus'}
                  </Text>
                  {event.location?.is_online && (
                    <Badge label="HYBRID & ONLINE STREAM" variant="primary" style={{ marginTop: 4, alignSelf: 'flex-start' }} />
                  )}
                </View>
              </View>
            </View>

            {/* Description */}
            {event.description ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <Text style={[styles.cardKicker, { color: colors.interactive }]}>ABOUT THIS GATHERING</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>{event.description}</Text>
              </View>
            ) : null}

            {/* Actions Bar */}
            <View style={styles.actionRow}>
              <Button
                label={registered ? 'Registered for Gathering' : 'RSVP / Register'}
                onPress={handleRegister}
                loading={registering}
                variant={registered ? 'outline' : 'primary'}
                size="lg"
                style={{ flex: 1 }}
                icon={<Icon name={registered ? 'checkmark-circle' : 'ticket-outline'} size={18} color={registered ? colors.interactive : colors.textInverse} />}
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
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
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
  },
});
