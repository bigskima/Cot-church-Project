import React, { useEffect, useState } from 'react';
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

  const [activeTab, setActiveTab] = useState<'wall' | 'submit'>('wall');
  const [wallScope, setWallScope] = useState<PrayerScope>('general');
  const [destination, setDestination] = useState<PrayerScope>('general');
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [privacy, setPrivacy] = useState<'pastoral_only' | 'prayer_team' | 'public_approved'>('pastoral_only');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
    (signal) => api.request<RoutedPrayer[]>(buildPrayerPath(wallScope), { signal })
  );

  const handleSubmitPrayer = async () => {
    if (!title.trim() || !request.trim()) {
      setSubmitError('Please provide a title and your prayer request details.');
      return;
    }
    if (destination === 'expression' && !expression?.id) {
      setSubmitError('Join or select an Expression before sending a request to an Expression prayer team.');
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
        setSubmitError('Your prayer request is safely stored. The church has been alerted to assign the appropriate prayer recipient for this scope.');
      }
      prayers.refresh();
      setTimeout(() => {
        setTitle('');
        setRequest('');
        setPrivacy('pastoral_only');
        setSubmittedSuccess(false);
        setSubmitError('');
        setActiveTab('wall');
      }, 1700);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit prayer request.');
    } finally {
      setSubmitting(false);
    }
  };

  const publicPrayerList = (prayers.data ?? []).filter(
    (prayer) => prayer.privacy === 'public_approved' && prayer.is_publicly_visible === true
  );

  const destinationName = destination === 'expression' && expression?.name
    ? `${expression.name} Prayer Ministry`
    : 'General Prayer Ministry';
  const wallTitle = wallScope === 'expression' && expression?.name
    ? `${expression.name} Prayer Wall`
    : 'Public Prayer Wall';

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
          subtitle="Send a petition to the right prayer ministry while keeping confidential requests inside their intended scope."
          showBack
        />

        <View style={styles.body}>
          <View style={styles.tabRow}>
            <Chip
              label="Prayer Wall"
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
                  <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>Your petition has been sent to {destinationName}.</Text>
                  {submitError ? <Text style={[styles.routingNote, { color: colors.textSecondary }]}>{submitError}</Text> : null}
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

                  <View style={styles.scopeBlock}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SEND TO</Text>
                    <View style={styles.scopeRow}>
                      <Pressable
                        onPress={() => setDestination('general')}
                        style={[
                          styles.scopeOption,
                          {
                            backgroundColor: destination === 'general' ? colors.primarySoft : colors.bgSecondary,
                            borderColor: destination === 'general' ? colors.interactive : colors.border,
                          },
                        ]}
                      >
                        <Icon name="globe-outline" size={17} color={destination === 'general' ? colors.interactive : colors.textMuted} />
                        <View style={styles.scopeTextGroup}>
                          <Text style={[styles.scopeTitle, { color: colors.text }]}>General Prayer Ministry</Text>
                          <Text style={[styles.scopeHelp, { color: colors.textMuted }]}>Handled by church-wide prayer or pastoral recipients.</Text>
                        </View>
                      </Pressable>

                      {canUseExpressionScope && expression ? (
                        <Pressable
                          onPress={() => setDestination('expression')}
                          style={[
                            styles.scopeOption,
                            {
                              backgroundColor: destination === 'expression' ? colors.primarySoft : colors.bgSecondary,
                              borderColor: destination === 'expression' ? colors.interactive : colors.border,
                            },
                          ]}
                        >
                          <Icon name="people-outline" size={17} color={destination === 'expression' ? colors.interactive : colors.textMuted} />
                          <View style={styles.scopeTextGroup}>
                            <Text style={[styles.scopeTitle, { color: colors.text }]}>{expression.name}</Text>
                            <Text style={[styles.scopeHelp, { color: colors.textMuted }]}>Stays inside this Expression and its assigned prayer ministry.</Text>
                          </View>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

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

                  <Text style={[styles.label, { color: colors.textSecondary }]}>PRIVACY & SHARING</Text>
                  <View style={styles.privacyOptions}>
                    {[
                      ['pastoral_only', 'Pastoral Care Only (Confidential)'],
                      ['prayer_team', 'Prayer Team'],
                      ['public_approved', destination === 'expression' ? 'Expression Prayer Wall (after approval)' : 'Public Prayer Wall (after approval)'],
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

                  {privacy === 'public_approved' ? (
                    <Text style={[styles.approvalHelp, { color: colors.textMuted }]}>Choosing a prayer wall gives permission to share the petition, but it will not appear on the wall until an authorized prayer or pastoral recipient approves it.</Text>
                  ) : null}

                  {mode === 'authenticated' ? (
                    <Pressable onPress={() => setIsAnonymous((value) => !value)} style={styles.anonymousRow}>
                      <Icon name={isAnonymous ? 'checkbox' : 'square-outline'} size={18} color={colors.interactive} />
                      <Text style={[styles.privacyText, { color: colors.textSecondary }]}>Hide my identity from public-facing prayer content</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.guestHelp, { color: colors.textMuted }]}>Visitors can submit to the General Prayer Ministry without signing in. Visitor submissions are stored anonymously.</Text>
                  )}

                  <Button
                    label={`Send to ${destination === 'expression' && expression ? expression.name : 'Prayer Ministry'}`}
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
              {canUseExpressionScope && expression ? (
                <View style={styles.wallScopeRow}>
                  <Chip label="General" selected={wallScope === 'general'} onPress={() => setWallScope('general')} />
                  <Chip label={expression.name} selected={wallScope === 'expression'} onPress={() => setWallScope('expression')} />
                </View>
              ) : null}

              <SectionHeader title={wallTitle} badge={publicPrayerList.length} />
              {prayers.loading && !prayers.data ? (
                <Skeleton height={140} count={3} />
              ) : prayers.error && !prayers.data ? (
                <ResourceError message={prayers.error} retry={prayers.refresh} />
              ) : publicPrayerList.length > 0 ? (
                publicPrayerList.map((p) => <PrayerCard key={p.id} prayer={p} onPray={() => {}} />)
              ) : (
                <EmptyState
                  title={wallScope === 'expression' ? 'No Expression Prayers on the Wall Yet' : 'No Public Prayers Yet'}
                  message={wallScope === 'expression'
                    ? 'Approved prayer-wall petitions from this Expression will appear here.'
                    : 'Approved General Prayer Ministry petitions will appear here.'}
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
  scopeBlock: { gap: spacing.xs },
  scopeRow: { gap: spacing.xs },
  scopeOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  scopeTextGroup: { flex: 1, gap: 2 },
  scopeTitle: { fontSize: 13, fontWeight: '700' },
  scopeHelp: { fontSize: 11, lineHeight: 15 },
  privacyOptions: { gap: spacing.xs },
  privacyOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  privacyText: { fontSize: 13, fontWeight: '500' },
  approvalHelp: { fontSize: 11, lineHeight: 16 },
  anonymousRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guestHelp: { fontSize: 11, lineHeight: 16 },
  wallSection: { gap: spacing.xs },
  wallScopeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  successBlock: { alignItems: 'center', padding: spacing.md, gap: spacing.xs },
  successTitle: { fontSize: 18, fontWeight: '800' },
  successSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 300 },
  routingNote: { fontSize: 11, textAlign: 'center', lineHeight: 16, maxWidth: 320, marginTop: spacing.xs },
  errorBanner: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderRadius: radius.md, padding: spacing.sm },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600' },
});
