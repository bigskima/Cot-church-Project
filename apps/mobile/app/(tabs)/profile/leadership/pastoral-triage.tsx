import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { LiveFollowUp, PrayerRequest } from '@/types/content';

export default function PastoralTriageScreen() {
  const { api } = useSession();
  const { colors, isDark } = useTheme();
  const [activeQueue, setActiveQueue] = useState<'prayer' | 'altar'>('prayer');

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
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Pastoral Triage & Care"
        subtitle="Confidential prayer petitions, altar call decisions, and ministerial follow-ups."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Queue Switcher */}
        <View
          style={[
            styles.queueSelector,
            { backgroundColor: isDark ? '#22140C' : '#E8D5C4' },
          ]}
        >
          {[
            ['prayer', `Prayer Queue (${prayers.data?.length ?? 0})`],
            ['altar', `Altar & Care (${followups.data?.length ?? 0})`],
          ].map(([q, label]) => {
            const isSelected = activeQueue === q;
            return (
              <Pressable
                key={q}
                onPress={() => setActiveQueue(q as any)}
                style={[
                  styles.queuePill,
                  isSelected ? {
                    backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                    ...shadows.sm,
                  } : null,
                ] as any}
              >
                <Text
                  style={[
                    styles.queuePillText,
                    { color: isSelected ? colors.text : colors.textMuted },
                    isSelected ? styles.queuePillTextActive : null,
                  ] as any}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Prayer Queue */}
        {activeQueue === 'prayer' && (
          <>
            <SectionHeader title="Active Prayer Petitions" dark={isDark} />
            {prayers.loading ? (
              <Skeleton height={140} count={2} dark={isDark} />
            ) : prayers.error && !prayers.data ? (
              <ResourceError
                offline={prayers.offline}
                message={prayers.error}
                retry={prayers.refresh}
                dark={isDark}
              />
            ) : prayers.data && prayers.data.length > 0 ? (
              prayers.data.map((prayer) => (
                <View
                  key={prayer.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    shadows.sm,
                  ] as any}
                >
                  <View style={styles.cardHeader}>
                    <Badge
                      label={prayer.status.toUpperCase()}
                      variant={prayer.status === 'answered' ? 'success' : 'prayer'}
                    />
                    <Text style={styles.confidentialityTag as any}>
                      {prayer.is_confidential ? '🔒 Confidential' : 'Public Wall'}
                    </Text>
                  </View>

                  <Text style={[styles.cardTitle, { color: colors.text }] as any}>{prayer.title}</Text>
                  <Text style={[styles.cardDescription, { color: colors.textSecondary }] as any}>
                    {prayer.description}
                  </Text>

                  <View style={[styles.actionRow, { borderTopColor: colors.border }] as any}>
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
                title="No Open Prayer Requests"
                message="All submitted prayer requests have been triaged and prayed over."
                icon="🕊️"
                dark={isDark}
              />
            )}
          </>
        )}

        {/* Altar & Follow-ups Queue */}
        {activeQueue === 'altar' && (
          <>
            <SectionHeader title="Live Stream Altar & Discipleship Queue" dark={isDark} />
            {followups.loading ? (
              <Skeleton height={140} count={2} dark={isDark} />
            ) : followups.data && followups.data.length > 0 ? (
              followups.data.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    shadows.sm,
                  ] as any}
                >
                  <View style={styles.cardHeader}>
                    <Badge label={item.type.replace('_', ' ').toUpperCase()} variant="gold" />
                    <Text style={[styles.cardDate, { color: colors.textMuted }] as any}>
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }] as any}>
                    {item.user_name || 'Anonymous Visitor'}
                  </Text>
                  <Text style={[styles.cardDescription, { color: colors.textSecondary }] as any}>
                    Contact: {item.user_email || 'No email on record'} · Status: {item.status}
                  </Text>
                  <View style={[styles.actionRow, { borderTopColor: colors.border }] as any}>
                    <Button
                      label="Assign Pastoral Counselor"
                      onPress={() => alert('Assigned to pastoral care.')}
                      variant="gold"
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
                dark={isDark}
              />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  queueSelector: {
    flexDirection: 'row',
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
  queuePillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  queuePillTextActive: {
    fontWeight: '900',
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
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
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  cardDescription: {
    fontSize: 13,
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
  },
});
