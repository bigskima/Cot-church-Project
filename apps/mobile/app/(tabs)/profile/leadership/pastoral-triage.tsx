import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { LiveFollowUp, PrayerRequest } from '@/types/content';

export default function PastoralTriageScreen() {
  const { api } = useSession();
  const [activeQueue, setActiveQueue] = useState<'prayer' | 'altar'>('prayer');
  const [noteInput, setNoteInput] = useState<{ [id: string]: string }>({});

  const prayers = useResource<PrayerRequest[]>('pastoral:prayers', (signal) =>
    api.request<PrayerRequest[]>('prayer-requests', { signal })
  );

  const followups = useResource<LiveFollowUp[]>('pastoral:followups', (signal) =>
    api.request<LiveFollowUp[]>('social-feed?type=followups', { signal }).catch(() => [] as LiveFollowUp[])
  );

  const updatePrayerStatus = async (id: string, status: 'praying' | 'answered' | 'archived') => {
    try {
      await api.request('prayer-requests', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      prayers.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update status');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Pastoral Triage & Care"
        subtitle="Confidential prayer petitions, altar call decisions, and ministerial follow-ups."
        showBack
      />

      <View style={styles.body}>
        {/* Queue Switcher */}
        <View style={styles.queueSelector}>
          {[
            ['prayer', `Prayer Queue (${prayers.data?.length ?? 0})`],
            ['altar', `Altar & Care (${followups.data?.length ?? 0})`],
          ].map(([q, label]) => {
            const isSelected = activeQueue === q;
            return (
              <Pressable
                key={q}
                onPress={() => setActiveQueue(q as any)}
                style={({ pressed }) => [
                  styles.queuePill,
                  isSelected && styles.queuePillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.queuePillText, isSelected && styles.queuePillTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Prayer Queue */}
        {activeQueue === 'prayer' && (
          <>
            <SectionHeader title="Active Prayer Petitions" />
            {prayers.loading ? (
              <Skeleton height={140} count={2} />
            ) : prayers.error && !prayers.data ? (
              <ResourceError
                offline={prayers.offline}
                message={prayers.error}
                retry={prayers.refresh}
              />
            ) : prayers.data && prayers.data.length > 0 ? (
              prayers.data.map((prayer) => (
                <View key={prayer.id} style={[styles.card, shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <Badge
                      label={prayer.status.toUpperCase()}
                      variant={prayer.status === 'answered' ? 'success' : 'prayer'}
                    />
                    <Text style={styles.confidentialityTag}>
                      {prayer.is_confidential ? '🔒 Confidential' : 'Public Wall'}
                    </Text>
                  </View>

                  <Text style={styles.cardTitle}>{prayer.title}</Text>
                  <Text style={styles.cardDescription}>{prayer.description}</Text>

                  <View style={styles.actionRow}>
                    <Button
                      label="Mark Praying"
                      onPress={() => updatePrayerStatus(prayer.id, 'praying')}
                      variant="secondary"
                      size="sm"
                    />
                    <Button
                      label="Answered Testimony"
                      onPress={() => updatePrayerStatus(prayer.id, 'answered')}
                      variant="gold"
                      size="sm"
                    />
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="Prayer Queue Cleared"
                message="No pending prayer requests awaiting pastoral attention."
                icon="🕊️"
              />
            )}
          </>
        )}

        {/* Altar & Follow-ups Queue */}
        {activeQueue === 'altar' && (
          <>
            <SectionHeader title="Live Stream Altar & Discipleship Queue" />
            {followups.loading ? (
              <Skeleton height={140} count={2} />
            ) : followups.data && followups.data.length > 0 ? (
              followups.data.map((item) => (
                <View key={item.id} style={[styles.card, shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <Badge label={item.type.replace('_', ' ').toUpperCase()} variant="gold" />
                    <Text style={styles.cardDate}>
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{item.user_name || 'Anonymous Visitor'}</Text>
                  <Text style={styles.cardDescription}>
                    Contact: {item.user_email || 'No email on record'} · Status: {item.status}
                  </Text>
                  <View style={styles.actionRow}>
                    <Button
                      label="Assign Pastoral Counselor"
                      onPress={() => alert('Assigned to pastoral care.')}
                      variant="primary"
                      size="sm"
                    />
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No Pending Follow-ups"
                message="Decisions for Christ, counselling requests, and membership interests appear here."
                icon="✝️"
              />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  queueSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E2D8',
    padding: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  queuePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuePillActive: {
    backgroundColor: palette.navy,
    ...shadows.sm,
  },
  queuePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.inkSecondary,
  },
  queuePillTextActive: {
    color: palette.white,
    fontWeight: '900',
  },
  card: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  confidentialityTag: {
    fontSize: 11,
    color: palette.prayer,
    fontWeight: '800',
  },
  cardDate: {
    fontSize: 11,
    color: palette.muted,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: palette.ink,
  },
  cardDescription: {
    fontSize: 13,
    color: palette.inkSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
