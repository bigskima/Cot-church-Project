import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  InputField,
  PrayerCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { PrayerRequest } from '@/types/content';

export default function PrayerScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode } = useSession();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'my_prayers' | 'wall'>('wall');
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [privacy, setPrivacy] = useState<'pastoral_only' | 'prayer_team' | 'public_approved'>('pastoral_only');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const prayerFeed = useResource<PrayerRequest[]>('prayer:feed', (signal) =>
    api.request<PrayerRequest[]>('prayer-requests', { signal }).catch(() => [])
  );

  const handleSubmitPrayer = async () => {
    if (!title.trim() || !request.trim()) {
      setErrorMsg('Please enter both a focus title and petition details.');
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
      setSuccessMsg('Your prayer petition has been confidentially submitted.');
      prayerFeed.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit prayer request.');
    } finally {
      setSubmitting(false);
    }
  };

  const prayers = prayerFeed.data ?? [];
  const publicPrayers = prayers.filter((p) => p.privacy !== 'pastoral_only');

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 100 },
        ]}
      >
        <ScreenHeader
          title="Prayer Petitions & Wall"
          subtitle="Bring your petitions before the Lord with confidence and fellowship."
          showBack
        />

        <View style={styles.body}>
          {/* Notification Messages */}
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(22, 163, 106, 0.12)', borderColor: 'rgba(22, 163, 106, 0.3)' }]}>
              <Icon name="checkmark-circle" size={18} color="#16A36A" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#16A36A' }]}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.3)' }]}>
              <Icon name="alert-circle" size={18} color="#E5484D" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#E5484D' }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Submit Prayer Request Form Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <View style={styles.cardHeader}>
              <Icon name="heart" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Submit a Prayer Petition</Text>
            </View>

            <InputField
              label="Prayer Focus / Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Healing, Family Breakthrough, Guidance..."
            />

            <InputField
              label="Petition Details"
              value={request}
              onChangeText={setRequest}
              multiline
              numberOfLines={4}
              placeholder="Share what is on your heart..."
            />

            {/* Privacy Scope Selector */}
            <View style={styles.privacySection}>
              <Text style={[styles.privacyLabel, { color: colors.textSecondary }]}>
                Confidentiality Scope
              </Text>
              <View style={styles.privacyChips}>
                <Chip
                  label="Pastoral Care Only"
                  selected={privacy === 'pastoral_only'}
                  onPress={() => setPrivacy('pastoral_only')}
                  icon={<Icon name="lock-closed" size={12} color={privacy === 'pastoral_only' ? colors.interactive : colors.textSecondary} />}
                />
                <Chip
                  label="Prayer Team"
                  selected={privacy === 'prayer_team'}
                  onPress={() => setPrivacy('prayer_team')}
                />
                <Chip
                  label="Public Prayer Wall"
                  selected={privacy === 'public_approved'}
                  onPress={() => setPrivacy('public_approved')}
                />
              </View>
            </View>

            <Button
              label="Submit Prayer Request"
              onPress={handleSubmitPrayer}
              loading={submitting}
              variant="primary"
              size="lg"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Prayer Wall Feed */}
          <View style={styles.wallSection}>
            <SectionHeader title="Community Prayer Wall" badge={publicPrayers.length} />
            {prayerFeed.loading ? (
              <Skeleton height={120} count={2} />
            ) : publicPrayers.length > 0 ? (
              publicPrayers.map((p) => (
                <PrayerCard
                  key={p.id}
                  prayer={p}
                />
              ))
            ) : (
              <EmptyState
                title="No Public Prayers Yet"
                message="Be the first to share an encouragement or prayer request with the church."
                iconName="heart-outline"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  privacySection: {
    gap: spacing.xs,
  },
  privacyLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  privacyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  wallSection: {
    gap: spacing.xs,
  },
});
