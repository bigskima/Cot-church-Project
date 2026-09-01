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
  const { api, mode } = useSession();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'wall' | 'submit'>('wall');
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [privacy, setPrivacy] = useState<'pastoral_only' | 'prayer_team' | 'public_approved'>('pastoral_only');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const prayers = useResource<PrayerRequest[]>('prayer:wall', (signal) => {
    return api.request<PrayerRequest[]>('prayer-requests', { signal });
  });

  const handleSubmitPrayer = async () => {
    if (!title.trim() || !request.trim()) {
      alert('Please provide a title and your prayer request details.');
      return;
    }

    setSubmitting(true);
    try {
      await api.request('prayer-requests', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          request: request.trim(),
          privacy,
          isAnonymous,
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
    } catch {
      alert('Unable to submit prayer request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const prayerList = prayers.data ?? [];

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
          subtitle="Be anxious for nothing, but in everything by prayer and supplication, let your requests be made known to God."
          showBack
        />

        <View style={styles.body}>
          {/* Tab Selector */}
          <View style={styles.tabRow}>
            <Chip
              label="Community Prayer Wall"
              selected={activeTab === 'wall'}
              onPress={() => setActiveTab('wall')}
              count={prayerList.length}
            />
            <Chip
              label="Submit Petition"
              selected={activeTab === 'submit'}
              onPress={() => setActiveTab('submit')}
              icon={<Icon name="add" size={14} color={activeTab === 'submit' ? '#FFFFFF' : colors.textSecondary} />}
            />
          </View>

          {activeTab === 'submit' ? (
            /* Submit Petition Form */
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              {submittedSuccess ? (
                <View style={styles.successBlock}>
                  <Icon name="checkmark-circle" size={44} color={colors.success} />
                  <Text style={[styles.successTitle, { color: colors.text }]}>Prayer Request Received</Text>
                  <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                    Our pastoral team and intercessors are standing in agreement with you.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.cardKicker, { color: colors.prayer }]}>CONFIDENTIAL PASTORAL SUBMISSION</Text>

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

                  {/* Privacy Level Selector */}
                  <Text style={[styles.label, { color: colors.textSecondary }]}>PRIVACY & SHARING SCOPE</Text>
                  <View style={styles.privacyOptions}>
                    {[
                      ['pastoral_only', 'Pastoral Staff Only (Confidential)'],
                      ['prayer_team', 'Sanctuary Intercessory Team'],
                      ['public_approved', 'Public Church Prayer Wall'],
                    ].map(([priv, label]) => (
                      <Pressable
                        key={priv}
                        onPress={() => setPrivacy(priv as any)}
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
            /* Prayer Wall List */
            <View style={styles.wallSection}>
              <SectionHeader title="Active Prayer Petitions" badge={prayerList.length} />
              {prayers.loading ? (
                <Skeleton height={140} count={3} />
              ) : prayers.error && !prayers.data ? (
                <ResourceError message={prayers.error} retry={prayers.refresh} />
              ) : prayerList.length > 0 ? (
                prayerList.map((p) => (
                  <PrayerCard
                    key={p.id}
                    prayer={p}
                    onPray={() => {}}
                  />
                ))
              ) : (
                <EmptyState
                  title="No Public Prayers Yet"
                  message="Submit a petition above to stand together with your church fellowship in prayer."
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
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  privacyOptions: {
    gap: spacing.xs,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  privacyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  wallSection: {
    gap: spacing.xs,
  },
  successBlock: {
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  successSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
});
