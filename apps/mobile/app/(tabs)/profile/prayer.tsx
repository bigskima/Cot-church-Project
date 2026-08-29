import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  InputField,
  PrayerCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { PrayerRequest } from '@/types/content';

export default function PrayerScreen() {
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [privacy, setPrivacy] = useState<'pastoral_only' | 'prayer_team' | 'public_approved'>('pastoral_only');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const myRequests = useResource<PrayerRequest[]>('profile:prayer', (signal) =>
    mode === 'authenticated'
      ? api.request<PrayerRequest[]>('prayer-requests', { signal })
      : Promise.resolve([])
  );

  const handleSubmitPrayer = async () => {
    if (!title.trim() || !request.trim()) {
      setErrorMsg('Please enter both a title and prayer request details.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('prayer-requests', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          request: request.trim(),
          privacy,
        }),
      });
      setTitle('');
      setRequest('');
      setSuccessMsg('Your prayer petition has been confidentially submitted to the pastoral team.');
      myRequests.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit prayer request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Sanctuary Prayer Wall"
        subtitle="Bring your burdens before the altar in faith and unity."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Submit Prayer Request Form Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.md,
          ] as any}
        >
          <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }] as any}>
            SUBMIT A PRAYER PETITION
          </Text>

          <InputField
            label="Prayer Focus / Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Healing for mother, Career breakthrough..."
            dark={isDark}
          />

          <InputField
            label="Petition Details"
            value={request}
            onChangeText={setRequest}
            placeholder="Describe your request. Our pastoral team and intercessors will stand with you in faith..."
            multiline
            numberOfLines={4}
            dark={isDark}
          />

          {/* Privacy Level Selector */}
          <Text style={[styles.privacyLabel, { color: colors.text }] as any}>CONFIDENTIALITY SCOPE</Text>
          <View style={styles.privacyRow}>
            {[
              ['pastoral_only', '🔒 Pastoral Care Only'],
              ['prayer_team', '🕊️ Prayer Team'],
              ['public_approved', '✦ Sanctuary Wall'],
            ].map(([key, label]) => {
              const isSelected = privacy === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPrivacy(key as any)}
                  style={[
                    styles.privacyChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : isDark
                        ? '#2E1C11'
                        : '#F1E3D3',
                      borderColor: isSelected ? colors.primaryDark : colors.border,
                    },
                  ] as any}
                >
                  <Text
                    style={[
                      styles.privacyText,
                      {
                        color: isSelected
                          ? '#140C07'
                          : isDark
                          ? '#FFFDF9'
                          : '#26140A',
                        fontWeight: isSelected ? '900' : '700',
                      },
                    ] as any}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

          <Button
            label="Submit Prayer Petition ➔"
            onPress={handleSubmitPrayer}
            variant="gold"
            size="lg"
            loading={submitting}
            style={{ marginTop: spacing.md } as any}
          />
        </View>

        {/* My Petitions List */}
        {mode === 'authenticated' && (
          <>
            <SectionHeader
              title="My Submitted Petitions"
              badge={myRequests.data?.length ?? 0}
              dark={isDark}
            />

            {myRequests.loading ? (
              <Skeleton height={120} count={2} dark={isDark} />
            ) : myRequests.error && !myRequests.data ? (
              <ResourceError
                offline={myRequests.offline}
                message={myRequests.error}
                retry={myRequests.refresh}
                dark={isDark}
              />
            ) : myRequests.data && myRequests.data.length > 0 ? (
              myRequests.data.map((item) => (
                <PrayerCard key={item.id} prayer={item} />
              ))
            ) : (
              <EmptyState
                title="No Petitions Recorded"
                message="Your submitted prayer petitions and pastoral updates will appear here."
                icon="🙏"
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
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  privacyLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: spacing.xs,
    marginBottom: spacing.xs + 2,
  },
  privacyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  privacyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  privacyText: {
    fontSize: 12,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  successText: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
});
