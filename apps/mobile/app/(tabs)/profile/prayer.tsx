import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { PrayerRequest } from '@/types/content';

export default function PrayerScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';
  const prayerPath = `prayer-requests${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`;

  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [privacy, setPrivacy] = useState<'pastoral_only' | 'prayer_team' | 'public_approved'>('pastoral_only');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const prayerFeed = useResource<PrayerRequest[]>(`prayer:feed:${organizationId || 'public'}`, (signal) =>
    api.request<PrayerRequest[]>(prayerPath, { signal })
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
          organizationId: organizationId || undefined,
          title: title.trim(),
          request: request.trim(),
          privacy,
          isAnonymous: mode === 'visitor' ? true : undefined,
        }),
      });
      setTitle('');
      setRequest('');
      setSuccessMsg(
        privacy === 'public_approved'
          ? 'Your prayer petition has been submitted to the Public Prayer Wall.'
          : 'Your prayer petition has been confidentially submitted.'
      );
      prayerFeed.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit prayer request.');
    } finally {
      setSubmitting(false);
    }
  };

  const prayers = prayerFeed.data ?? [];
  // Only explicitly public petitions belong on the public wall. Prayer-team and
  // pastoral-only petitions may be returned to their owner but must never render here.
  const publicPrayers = prayers.filter((p) => p.privacy === 'public_approved');

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

            <View style={styles.privacySection}>
              <Text style={[styles.privacyLabel, { color: colors.textSecondary }]}>Confidentiality Scope</Text>
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
              {mode === 'visitor' ? (
                <Text style={[styles.helper, { color: colors.textMuted }]}>You can submit without signing in. Visitor petitions are recorded anonymously.</Text>
              ) : null}
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

          <View style={styles.wallSection}>
            <SectionHeader title="Public Prayer Wall" badge={publicPrayers.length} />
            {prayerFeed.loading && !prayerFeed.data ? (
              <Skeleton height={120} count={2} />
            ) : prayerFeed.error && !prayerFeed.data ? (
              <ResourceError message={prayerFeed.error} retry={prayerFeed.refresh} />
            ) : publicPrayers.length > 0 ? (
              publicPrayers.map((p) => <PrayerCard key={p.id} prayer={p} />)
            ) : (
              <EmptyState
                title="No Public Prayers Yet"
                message="Public prayer petitions will appear here when people choose to share them with the community."
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
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  banner: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  card: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  privacySection: { gap: spacing.xs },
  privacyLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  privacyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  helper: { fontSize: 11, lineHeight: 16 },
  wallSection: { gap: spacing.xs },
});
