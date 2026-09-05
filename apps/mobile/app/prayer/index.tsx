import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  BottomSheet,
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

type PrayerScope = 'general' | 'expression';
type RoutedPrayer = PrayerRequest & {
  organization_id?: string;
  branch_id?: string | null;
  scope?: PrayerScope;
  routing_status?: 'queued' | 'routed' | 'unassigned';
  public_approved_at?: string | null;
  is_publicly_visible?: boolean;
  answered_testimony?: string | null;
};

export default function PrayerScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;

  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';

  const [submitOpen, setSubmitOpen] = useState(false);
  const [wallScope, setWallScope] = useState<PrayerScope>('general');
  const [destination, setDestination] = useState<PrayerScope>('general');
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [privacy, setPrivacy] = useState<'pastoral_only' | 'prayer_team' | 'public_approved'>('pastoral_only');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [prayingIds, setPrayingIds] = useState<Set<string>>(() => new Set());
  const [wallActionError, setWallActionError] = useState('');

  const canUseExpressionScope = mode === 'authenticated' && Boolean(expression?.id);

  useEffect(() => {
    if (!canUseExpressionScope) {
      setWallScope('general');
      setDestination('general');
    }
  }, [canUseExpressionScope]);

  const buildPrayerPath = (scope: PrayerScope) => {
    const query = new URLSearchParams({ scope });
    if (organizationId) query.set('organizationId', organizationId);
    if (scope === 'expression' && expression?.id) query.set('branchId', expression.id);
    return `prayer-requests?${query.toString()}`;
  };

  const prayers = useResource<RoutedPrayer[]>(
    `prayer:wall:${wallScope}:${organizationId || 'auto'}:${expression?.id || 'none'}`,
    (signal) => api.request<RoutedPrayer[]>(buildPrayerPath(wallScope), { signal }),
  );

  const resetSubmission = () => {
    setTitle('');
    setRequest('');
    setPrivacy('pastoral_only');
    setIsAnonymous(false);
    setSubmittedSuccess(false);
    setSubmitError('');
  };

  const openSubmission = () => {
    resetSubmission();
    setDestination(canUseExpressionScope ? wallScope : 'general');
    setSubmitOpen(true);
  };

  const closeSubmission = () => {
    if (submitting) return;
    setSubmitOpen(false);
    resetSubmission();
  };

  const handleSubmitPrayer = async () => {
    if (!title.trim() || !request.trim()) {
      setSubmitError('Please provide a title and your prayer request details.');
      return;
    }
    if (destination === 'expression' && !expression?.id) {
      setSubmitError('Enter an Expression before sending a request to its prayer ministry.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.request<RoutedPrayer>('prayer-requests', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: organizationId || undefined,
          branchId: destination === 'expression' ? expression?.id : undefined,
          title: title.trim(),
          request: request.trim(),
          privacy,
          isAnonymous: mode === 'visitor' ? true : isAnonymous,
        }),
      });

      setSubmittedSuccess(true);
      setWallScope(destination);
      if (result.routing_status === 'unassigned') {
        setSubmitError('Your request is safely stored while the church assigns the appropriate prayer recipient.');
      }
      await prayers.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit prayer request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePray = async (prayer: RoutedPrayer) => {
    if (prayer.viewer_has_prayed || prayingIds.has(prayer.id)) return;
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: '/prayer' } } as any);
      return;
    }

    setWallActionError('');
    setPrayingIds((current) => {
      const next = new Set(current);
      next.add(prayer.id);
      return next;
    });

    try {
      await api.request<{ id: string; prayer_count: number; viewer_has_prayed: boolean }>('prayer-requests', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'pray', id: prayer.id }),
      });
      await prayers.refresh();
    } catch (error) {
      setWallActionError(error instanceof Error ? error.message : 'Unable to record that you are praying for this request.');
    } finally {
      setPrayingIds((current) => {
        const next = new Set(current);
        next.delete(prayer.id);
        return next;
      });
    }
  };

  const publicPrayerList = (prayers.data ?? []).filter(
    (prayer) => prayer.privacy === 'public_approved' && prayer.is_publicly_visible === true,
  );

  const destinationName =
    destination === 'expression' && expression?.name ? `${expression.name} Prayer Ministry` : 'General Prayer Ministry';
  const wallTitle =
    wallScope === 'expression' && expression?.name ? `${expression.name} Prayer Wall` : 'Public Prayer Wall';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title="Prayer"
            kicker="PRAYER MINISTRY"
            subtitle="Share confidential petitions or pray with approved community requests."
            showBack
            rightAction={<Button label="Send prayer" onPress={openSubmission} size="sm" />}
          />
        </View>

        <View style={styles.body}>
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.prayerSoft }]}>
              <Icon name="heart" size={24} color={colors.prayer} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Prayer is handled with care</Text>
              <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>
                Confidential requests stay inside the audience you choose. Prayer-wall requests appear only after approval.
              </Text>
            </View>
          </View>

          {canUseExpressionScope && expression ? (
            <View style={[styles.scopeSwitch, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Chip label="General" selected={wallScope === 'general'} onPress={() => setWallScope('general')} />
              <Chip label={expression.name} selected={wallScope === 'expression'} onPress={() => setWallScope('expression')} />
            </View>
          ) : null}

          <View style={styles.wallSection}>
            <SectionHeader title={wallTitle} badge={publicPrayerList.length} subtitle="Approved petitions the community can pray with" />
            {wallActionError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}>
                <Icon name="alert-circle" size={17} color={colors.live} />
                <Text style={[styles.errorText, { color: colors.live }]}>{wallActionError}</Text>
              </View>
            ) : null}
            {prayers.loading && !prayers.data ? (
              <Skeleton height={140} count={3} />
            ) : prayers.error && !prayers.data ? (
              <ResourceError message={prayers.error} retry={prayers.refresh} />
            ) : publicPrayerList.length > 0 ? (
              publicPrayerList.map((prayer) => (
                <PrayerCard
                  key={prayer.id}
                  prayer={prayer}
                  busy={prayingIds.has(prayer.id)}
                  onPray={() => void handlePray(prayer)}
                />
              ))
            ) : (
              <EmptyState
                title={wallScope === 'expression' ? 'No Expression prayers on the wall yet' : 'No public prayers yet'}
                message={
                  wallScope === 'expression'
                    ? 'Approved prayer-wall petitions from this Expression will appear here.'
                    : 'Approved General Prayer Ministry petitions will appear here.'
                }
                iconName="heart-outline"
                actionLabel="Send a prayer"
                onAction={openSubmission}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={submitOpen}
        onClose={closeSubmission}
        title={submittedSuccess ? 'Prayer received' : 'Send a prayer'}
        subtitle={submittedSuccess ? `Sent to ${destinationName}` : 'Choose the right ministry and privacy level for this petition.'}
        maxHeightPercent={94}
      >
        {submittedSuccess ? (
          <View style={styles.successBlock}>
            <View style={[styles.successIcon, { backgroundColor: colors.successSoft }]}>
              <Icon name="checkmark-circle" size={36} color={colors.success} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Your prayer request has been received</Text>
            <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
              It was sent to {destinationName}. Its visibility remains governed by the privacy option you selected.
            </Text>
            {submitError ? <Text style={[styles.routingNote, { color: colors.textMuted }]}>{submitError}</Text> : null}
            <Button label="Done" onPress={closeSubmission} size="lg" fullWidth />
          </View>
        ) : (
          <View style={styles.form}>
            {submitError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}>
                <Icon name="alert-circle" size={17} color={colors.live} />
                <Text style={[styles.errorText, { color: colors.live }]}>{submitError}</Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: colors.textSecondary }]}>SEND TO</Text>
            <View style={styles.optionStack}>
              <Pressable
                onPress={() => setDestination('general')}
                style={[
                  styles.scopeOption,
                  {
                    backgroundColor: destination === 'general' ? colors.primarySoft : colors.card,
                    borderColor: destination === 'general' ? colors.interactive : colors.borderSubtle,
                  },
                ]}
              >
                <Icon name="globe-outline" size={18} color={destination === 'general' ? colors.interactive : colors.textMuted} />
                <View style={styles.flex}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>General Prayer Ministry</Text>
                  <Text style={[styles.optionHelp, { color: colors.textMuted }]}>Church-wide pastoral or prayer recipients.</Text>
                </View>
              </Pressable>

              {canUseExpressionScope && expression ? (
                <Pressable
                  onPress={() => setDestination('expression')}
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: destination === 'expression' ? colors.primarySoft : colors.card,
                      borderColor: destination === 'expression' ? colors.interactive : colors.borderSubtle,
                    },
                  ]}
                >
                  <Icon name="people-outline" size={18} color={destination === 'expression' ? colors.interactive : colors.textMuted} />
                  <View style={styles.flex}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>{expression.name}</Text>
                    <Text style={[styles.optionHelp, { color: colors.textMuted }]}>Stays inside this Expression and its prayer ministry.</Text>
                  </View>
                </Pressable>
              ) : null}
            </View>

            <InputField label="Prayer title / need" value={title} onChangeText={setTitle} placeholder="Healing, provision, guidance…" />
            <InputField label="Prayer details" value={request} onChangeText={setRequest} multiline numberOfLines={5} placeholder="Share what you are believing God for…" />

            <Text style={[styles.label, { color: colors.textSecondary }]}>PRIVACY</Text>
            <View style={styles.optionStack}>
              {[
                ['pastoral_only', 'Pastoral care only', 'Confidential to authorized pastoral recipients.'],
                ['prayer_team', 'Prayer team', 'Visible to the assigned prayer ministry.'],
                [
                  'public_approved',
                  destination === 'expression' ? 'Expression prayer wall' : 'Public prayer wall',
                  'May appear on the prayer wall after approval.',
                ],
              ].map(([value, optionTitle, help]) => (
                <Pressable
                  key={value}
                  onPress={() => setPrivacy(value as typeof privacy)}
                  style={[
                    styles.privacyOption,
                    {
                      backgroundColor: privacy === value ? colors.prayerSoft : colors.card,
                      borderColor: privacy === value ? colors.prayer : colors.borderSubtle,
                    },
                  ]}
                >
                  <Icon
                    name={privacy === value ? 'radio-button-on' : 'radio-button-off'}
                    size={17}
                    color={privacy === value ? colors.prayer : colors.textMuted}
                  />
                  <View style={styles.flex}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>{optionTitle}</Text>
                    <Text style={[styles.optionHelp, { color: colors.textMuted }]}>{help}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {mode === 'authenticated' ? (
              <Pressable
                onPress={() => setIsAnonymous((value) => !value)}
                style={[styles.anonymousRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
              >
                <Icon name={isAnonymous ? 'checkbox' : 'square-outline'} size={19} color={colors.interactive} />
                <View style={styles.flex}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Hide my identity publicly</Text>
                  <Text style={[styles.optionHelp, { color: colors.textMuted }]}>Your identity can still be available to authorized ministry recipients when required.</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={[styles.visitorHelp, { color: colors.textMuted }]}>Visitor submissions are stored anonymously.</Text>
            )}

            <Button
              label={`Send to ${destination === 'expression' && expression ? expression.name : 'Prayer Ministry'}`}
              onPress={() => void handleSubmitPrayer()}
              loading={submitting}
              size="lg"
              fullWidth
              icon={<Icon name="heart" size={16} color="#FFFFFF" />}
            />
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xl },
  flex: { flex: 1 },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  heroIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  heroCopy: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  scopeSwitch: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: 5, borderRadius: radius.xl, borderWidth: 1, alignSelf: 'flex-start' },
  wallSection: { gap: spacing.sm },
  form: { gap: spacing.md },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  optionStack: { gap: spacing.sm },
  scopeOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  privacyOption: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  optionTitle: { fontSize: 13, fontWeight: '700' },
  optionHelp: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  anonymousRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  visitorHelp: { fontSize: 11, lineHeight: 16 },
  successBlock: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
  successIcon: { width: 68, height: 68, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  successSubtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 420 },
  routingNote: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderRadius: radius.lg, padding: spacing.sm },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600' },
});
