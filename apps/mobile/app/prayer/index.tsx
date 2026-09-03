import React, { useState } from 'react';
import {
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

  const [activeTab, setActiveTab] = useState<'wall' | 'submit'>('wall');
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [privacy, setPrivacy] = useState<'pastoral_only' | 'prayer_team' | 'public_approved'>('pastoral_only');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const prayers = useResource<PrayerRequest[]>(`prayer:wall:${organizationId || 'public'}`, (signal) =>
    api.request<PrayerRequest[]>(prayerPath, { signal })
  );

  const handleSubmitPrayer = async () => {
    if (!title.trim() || !request.trim()) {
      setSubmitError('Please provide a title and your prayer request details.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await api.request('prayer-requests', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: organizationId || undefined,
          title: title.trim(),
          request: request.trim(),
          privacy,
          isAnonymous: mode === 'visitor' ? true : isAnonymous,
        }),
      });

      setSubmittedSuccess(true);
      prayers.refresh();
      setTimeout(() => {
        setTitle('');
        setRequest('');
        setSubmittedSuccess(false);
        setActiveTab('wall');
      }, 1500);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit prayer request.');
    } finally {
      setSubmitting(false);
    }
  };

  const publicPrayerList = (prayers.data ?? []).filter((prayer) => prayer.privacy === 'public_approved');

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 60 },
        ]}
      >
        <ScreenHeader
          title="Prayer Ministry & Intercession"
          subtitle="Bring your prayer petitions before the Lord and, when you choose, share them with the community."
          showBack
        />

        <View style={styles.body}>
          <View style={styles.tabRow}>
            <Chip
              label="Public Prayer Wall"
              selected={activeTab === 'wall'}
              onPress={() => setActiveTab('wall')}
              count={publicPrayerList.length}
            />
            <Chip
              label="Submit Petition"
              selected={activeTab === 'submit'}
              onPress={() => setActiveTab('submit')}
              icon={<Icon name="add" size={14} color={activeTab === 'submit' ? '#FFFFFF' : colors.textSecondary} />}
            />
          </View>

          {activeTab === 'submit' ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              {submittedSuccess ? (
                <View style={styles.successBlock}>
                  <Icon name="checkmark-circle" size={44} color={colors.success} />
                  <Text style={[styles.successTitle, { color: colors.text }]}>Prayer Request Received</Text>
                  <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>Your petition has been received successfully.</Text>
                </View>
              ) : (
                <>
                  {submitError ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}>
                      <Icon name="alert-circle" size={17} color={colors.live} />
                      <Text style={[styles.errorText, { color: colors.live }]}>{submitError}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.cardKicker, { color: colors.prayer }]}>PRAYER PETITION</Text>

                  <InputField
                    label="Prayer Title / Need"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Healing, Family Provision, Guidance"
                  />

                  <InputField
                    label="Prayer Details"
                    value={request}
                    onChangeText={setRequest}
                    multiline
                    numberOfLines={4}
                    placeholder="Share what you are believing God for..."
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>PRIVACY & SHARING SCOPE</Text>
                  <View style={styles.privacyOptions}>
                    {[
                      ['pastoral_only', 'Pastoral Staff Only (Confidential)'],
                      ['prayer_team', 'Prayer Team'],
                      ['public_approved', 'Public Prayer Wall'],
                    ].map(([priv, label]) => (
                      <Pressable
                        key={priv}
                        onPress={() => setPrivacy(priv as typeof privacy)}
                        style={[
                          styles.privacyOption,
                          {
                            backgroundColor: privacy === priv ? colors.primarySoft : colors.bgSecondary,
                            borderColor: privacy === priv ? colors.interactive : colors.border,
                          },
                        ]}
                      >
                        <Icon
                          name={privacy === priv ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={privacy === priv ? colors.interactive : colors.textMuted}
                        />
                        <Text style={[styles.privacyText, { color: colors.text }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {mode === 'authenticated' ? (
                    <Pressable onPress={() => setIsAnonymous((value) => !value)} style={styles.anonymousRow}>
                      <Icon name={isAnonymous ? 'checkbox' : 'square-outline'} size={18} color={colors.interactive} />
                      <Text style={[styles.privacyText, { color: colors.textSecondary }]}>Hide my identity from the public-facing petition</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.guestHelp, { color: colors.textMuted }]}>Visitors can submit without signing in. Visitor submissions are stored anonymously.</Text>
                  )}

                  <Button
                    label="Submit Prayer Request"
                    onPress={handleSubmitPrayer}
                    loading={submitting}
                    variant="primary"
                    size="lg"
                    style={{ marginTop: spacing.sm }}
                    icon={<Icon name="heart" size={16} color="#FFFFFF" />}
                  />
                </>
              )}
            </View>
          ) : (
            <View style={styles.wallSection}>
              <SectionHeader title="Public Prayer Wall" badge={publicPrayerList.length} />
              {prayers.loading && !prayers.data ? (
                <Skeleton height={140} count={3} />
              ) : prayers.error && !prayers.data ? (
                <ResourceError message={prayers.error} retry={prayers.refresh} />
              ) : publicPrayerList.length > 0 ? (
                publicPrayerList.map((p) => <PrayerCard key={p.id} prayer={p} onPray={() => {}} />)
              ) : (
                <EmptyState
                  title="No Public Prayers Yet"
                  message="Public petitions will appear here when someone chooses the Public Prayer Wall scope."
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
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  tabRow: { flexDirection: 'row', gap: spacing.xs },
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  cardKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  privacyOptions: { gap: spacing.xs },
  privacyOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  privacyText: { fontSize: 13, fontWeight: '500' },
  anonymousRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guestHelp: { fontSize: 11, lineHeight: 16 },
  wallSection: { gap: spacing.xs },
  successBlock: { alignItems: 'center', padding: spacing.md, gap: spacing.xs },
  successTitle: { fontSize: 18, fontWeight: '800' },
  successSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 300 },
  errorBanner: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderRadius: radius.md, padding: spacing.sm },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600' },
});
