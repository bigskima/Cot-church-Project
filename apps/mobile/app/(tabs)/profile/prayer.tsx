import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Sanctuary Prayer Wall"
        subtitle="Submit confidential prayer requests, altar petitions, and stand in agreement."
        showBack
      />

      <View style={styles.body}>
        {/* Prayer Request Form Card */}
        <View style={[styles.formCard, shadows.md]}>
          <Text style={styles.formTitle}>SUBMIT A PRAYER PETITION</Text>

          <InputField
            label="Prayer Subject / Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Healing, Career breakthrough, Family peace..."
          />

          <InputField
            label="Details of your request"
            value={request}
            onChangeText={setRequest}
            placeholder="Describe your situation so ministers can agree in faith..."
            multiline
            numberOfLines={4}
            style={{ height: 90, textAlignVertical: 'top' }}
          />

          {/* Privacy Level Selector */}
          <Text style={styles.privacyLabel}>CONFIDENTIALITY LEVEL</Text>
          <View style={styles.privacySelector}>
            {[
              ['pastoral_only', '🔒 Pastoral Team Only', 'Senior ministers and pastoral counselors'],
              ['prayer_team', '🕊️ Dedicated Prayer Team', 'Authorized intercessors team'],
              ['public_approved', '🌐 Congregation Wall', 'Visible to members after pastoral review'],
            ].map(([key, label, desc]) => {
              const isSelected = privacy === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPrivacy(key as any)}
                  style={({ pressed }) => [
                    styles.privacyOption,
                    isSelected && styles.privacyOptionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.privacyOptionTitle, isSelected && styles.privacyOptionTitleActive]}>
                    {label}
                  </Text>
                  <Text style={styles.privacyOptionDesc}>{desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Feedback messages */}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          {successMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successEmoji}>🕊️</Text>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          <Button
            label="Submit Prayer Request ➔"
            onPress={handleSubmitPrayer}
            variant="primary"
            size="lg"
            loading={submitting}
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* Previous Prayer Requests */}
        <SectionHeader title="Your Submitted Petitions" />
        {myRequests.loading ? (
          <Skeleton height={120} count={2} />
        ) : myRequests.error && !myRequests.data ? (
          <ResourceError
            offline={myRequests.offline}
            message={myRequests.error}
            retry={myRequests.refresh}
          />
        ) : myRequests.data && myRequests.data.length > 0 ? (
          myRequests.data.map((p) => (
            <PrayerCard
              key={p.id}
              prayer={p}
              onPray={() =>
                api
                  .request('prayer-requests', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'pray', id: p.id }),
                  })
                  .then(() => myRequests.refresh())
              }
            />
          ))
        ) : (
          <EmptyState
            title="No Petitions Submitted Yet"
            message="Cast all your anxiety on Him, because He cares for you (1 Peter 5:7)."
            icon="🙏"
          />
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
  formCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  formTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  privacyLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  privacySelector: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  privacyOption: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSubtle,
    borderWidth: 1,
    borderColor: palette.line,
  },
  privacyOptionActive: {
    backgroundColor: '#F3EFFC',
    borderColor: palette.prayer,
  },
  privacyOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.ink,
  },
  privacyOptionTitleActive: {
    color: palette.prayer,
    fontWeight: '900',
  },
  privacyOptionDesc: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 2,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 4,
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  successEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  successText: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
