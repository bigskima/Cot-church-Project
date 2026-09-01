import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Icon,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { LiveFollowUp, PrayerRequest } from '@/types/content';

export default function PastoralTriageScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();
  const [activeQueue, setActiveQueue] = useState<'prayer' | 'care'>('prayer');

  const prayers = useResource<PrayerRequest[]>('pastoral:prayers', (signal) =>
    api.request<PrayerRequest[]>('prayer-requests', { signal }).catch(() => [])
  );

  const followups = useResource<LiveFollowUp[]>('pastoral:followups', (signal) =>
    api.request<LiveFollowUp[]>('social-feed?type=followups', { signal }).catch(() => [])
  );

  const updatePrayerStatus = async (id: string, status: 'praying' | 'answered' | 'archived') => {
    try {
      await api.request('prayer-requests', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      prayers.refresh();
    } catch (err) {
      // Ignored
    }
  };

  const prayerList = prayers.data ?? [];
  const careList = followups.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title="Pastoral Triage & Care"
          subtitle="Review confidential member prayer requests, pastoral follow-ups, and altar responses."
          showBack
        />

        {/* Queue Switcher */}
        <View style={styles.tabRow}>
          <Chip
            label="Prayer Requests"
            selected={activeQueue === 'prayer'}
            onPress={() => setActiveQueue('prayer')}
            count={prayerList.length}
          />
          <Chip
            label="Altar & Care Responses"
            selected={activeQueue === 'care'}
            onPress={() => setActiveQueue('care')}
            count={careList.length}
          />
        </View>

        <View style={styles.body}>
          {activeQueue === 'prayer' ? (
            <View style={styles.queueSection}>
              <SectionHeader title="Confidential Prayer Queue" badge={prayerList.length} />
              {prayers.loading ? (
                <Skeleton height={140} count={2} />
              ) : prayers.error && !prayers.data ? (
                <ResourceError message={prayers.error} retry={prayers.refresh} />
              ) : prayerList.length > 0 ? (
                prayerList.map((p) => (
                  <View
                    key={p.id}
                    style={[styles.triageCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                  >
                    <View style={styles.cardHeader}>
                      <Badge
                        label={p.privacy === 'pastoral_only' ? 'CONFIDENTIAL PASTORAL' : 'PRAYER WALL'}
                        variant={p.privacy === 'pastoral_only' ? 'prayer' : 'primary'}
                      />
                      <Text style={[styles.dateText, { color: colors.textMuted }]}>
                        {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>{p.title}</Text>
                    {p.request || p.description ? (
                      <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                        {p.request || p.description}
                      </Text>
                    ) : null}

                    {/* Action Bar */}
                    <View style={[styles.actionBar, { borderTopColor: colors.borderSubtle }]}>
                      <Text style={[styles.statusLabel, { color: colors.textMuted }]}>
                        Status: <Text style={{ color: colors.interactive, fontWeight: '700' }}>{p.status || 'submitted'}</Text>
                      </Text>

                      <View style={styles.btnRow}>
                        <Button
                          label="Mark Praying"
                          onPress={() => updatePrayerStatus(p.id, 'praying')}
                          variant="outline"
                          size="sm"
                        />
                        <Button
                          label="Answered"
                          onPress={() => updatePrayerStatus(p.id, 'answered')}
                          variant="primary"
                          size="sm"
                        />
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState
                  title="No Pending Prayer Requests"
                  message="All incoming petitions have been triaged by the pastoral team."
                  iconName="shield-checkmark-outline"
                />
              )}
            </View>
          ) : (
            /* Altar & Care Queue */
            <View style={styles.queueSection}>
              <SectionHeader title="Altar Call & Counselling Log" badge={careList.length} />
              {careList.length > 0 ? (
                careList.map((f) => (
                  <View
                    key={f.id}
                    style={[styles.triageCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                  >
                    <View style={styles.cardHeader}>
                      <Badge label={f.type.toUpperCase()} variant="primary" />
                      <Text style={[styles.dateText, { color: colors.textMuted }]}>
                        {new Date(f.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>{f.user_name || 'Anonymous Visitor'}</Text>
                    {f.user_email ? (
                      <Text style={[styles.bodyText, { color: colors.interactive }]}>{f.user_email}</Text>
                    ) : null}
                    {f.private_note ? (
                      <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{f.private_note}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <EmptyState
                  title="No Follow-Up Requests"
                  message="Incoming live service decisions and prayer requests will appear here."
                  iconName="heart-outline"
                />
              )}
            </View>
          )}
        </View>
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  queueSection: {
    gap: spacing.xs,
  },
  triageCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 11,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs + 4,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  statusLabel: {
    fontSize: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
