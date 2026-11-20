import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  LeaderCard,
  ProgressiveFlow,
  type ProgressiveFlowStep,
  ResourceError,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { putSignedUpload, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { LeadershipProfile } from '@church/types';
import { LeaderMemberPicker, leaderCandidateProfile, type LeaderCandidate } from '@/features/leadership/LeaderMemberPicker';
import { useGeneralMinistryAccess } from './useGeneralMinistryAccess';

type ImageUploadIntent = { signedUploadUrl: string; publicUrl: string };

const STEPS: ProgressiveFlowStep[] = [
  { key: 'person', label: 'Person', hint: 'Choose the existing member connected to this leader.', icon: 'person-add-outline' },
  { key: 'role', label: 'Role', hint: 'Set ministry responsibility and biography.', icon: 'shield-checkmark-outline' },
  { key: 'presentation', label: 'Presentation', hint: 'Choose portrait and public visibility.', icon: 'image-outline' },
  { key: 'review', label: 'Review', hint: 'Confirm how the leader will appear.', icon: 'checkmark-circle-outline' },
];

export default function GeneralChurchLeadershipPanel() {
  const { api, context } = useSession();
  const { colors } = useTheme();
  const access = useGeneralMinistryAccess();
  const organization = context?.organization ?? context?.organizations?.[0];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<LeadershipProfile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [ministry, setMinistry] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [portrait, setPortrait] = useState<UploadFile | null>(null);
  const [featurePublicly, setFeaturePublicly] = useState(true);
  const [founder, setFounder] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const leaders = useResource<LeadershipProfile[]>(
    `general:leadership-directory:${organization?.id ?? 'none'}`,
    (signal) => access.canManageLeadership ? api.request<LeadershipProfile[]>('church-story?view=leadership-manage', { signal }) : Promise.resolve([]),
  );

  const reset = () => {
    setStep(0);
    setEditing(null);
    setProfileId(null);
    setDisplayName('');
    setRoleTitle('');
    setMinistry('');
    setShortBio('');
    setPortraitUrl('');
    setPortrait(null);
    setFeaturePublicly(true);
    setFounder(false);
    setActive(true);
    setError('');
  };

  const close = () => {
    if (!saving) {
      setOpen(false);
      reset();
    }
  };

  const openCreate = () => {
    if (!access.canManageLeadership) return;
    reset();
    setSuccess('');
    setOpen(true);
  };

  const openEdit = (leader: LeadershipProfile) => {
    if (!access.canManageLeadership) return;
    setEditing(leader);
    setProfileId(leader.profile_id ?? null);
    setDisplayName(leader.display_name ?? '');
    setRoleTitle(leader.role_title ?? '');
    setMinistry(leader.ministry ?? '');
    setShortBio(leader.short_bio ?? '');
    setPortraitUrl(leader.portrait_url ?? '');
    setPortrait(null);
    setFeaturePublicly(leader.is_featured_public === true);
    setFounder(leader.is_founder === true);
    setActive(leader.is_active !== false);
    setError('');
    setSuccess('');
    setStep(0);
    setOpen(true);
  };

  const selectCandidate = (candidate: LeaderCandidate) => {
    const profile = leaderCandidateProfile(candidate);
    if (!profile) return;
    setProfileId(profile.id);
    setDisplayName(profile.display_name || profile.username || '');
    setPortraitUrl(profile.avatar_url || '');
    setPortrait(null);
    setError('');
  };

  const choosePortrait = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError('Allow photo-library access to choose a leader photo.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return setError('Choose a JPG, PNG, or WebP photo.');
    setPortrait({
      uri: asset.uri,
      name: asset.fileName || `leader-${Date.now()}.jpg`,
      mimeType,
      size: asset.fileSize,
      file: (asset as any).file,
    });
    setError('');
  };

  const canContinue = () => {
    if (step === 0) return Boolean(editing || profileId);
    if (step === 1) return Boolean(displayName.trim() && roleTitle.trim());
    return true;
  };

  const next = () => {
    setError('');
    if (!canContinue()) {
      setError(step === 0 ? 'Search and select an existing member before continuing.' : 'Add the leader display name and role title.');
      return;
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const save = async () => {
    if (!access.canManageLeadership) return;
    if (!editing && !profileId) {
      setStep(0);
      setError('Search and select an existing member before adding a leader.');
      return;
    }
    if (!displayName.trim() || !roleTitle.trim()) {
      setStep(1);
      setError('Provide the leader name and role title.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      let savedPortraitUrl = portraitUrl || null;
      if (portrait) {
        const intent = await api.request<ImageUploadIntent>('church-story', {
          method: 'POST',
          body: JSON.stringify({ action: 'create_portrait_upload', mimeType: portrait.mimeType }),
        });
        await putSignedUpload(intent.signedUploadUrl, portrait);
        savedPortraitUrl = intent.publicUrl;
      }

      await api.request('church-story', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : { profileId }),
          displayName: displayName.trim(),
          roleTitle: roleTitle.trim(),
          ministry: ministry.trim() || null,
          shortBio: shortBio.trim() || '',
          portraitUrl: savedPortraitUrl,
          isFeaturedPublic: featurePublicly,
          isFounder: founder,
          ...(editing ? { isActive: active } : {}),
        }),
      });

      setOpen(false);
      setSuccess(editing ? 'Leader profile updated.' : 'Leader added to Our Leaders.');
      reset();
      await leaders.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save this leader.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 0) {
      return editing && profileId ? (
        <View style={[styles.linkedCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="link-outline" size={19} color={colors.interactive} />
          <View style={styles.flex}>
            <Text style={[styles.linkedTitle, { color: colors.text }]}>Member connected</Text>
            <Text style={[styles.linkedText, { color: colors.textMuted }]}>
              This leader stays connected to the member’s COT profile. You can still update how they appear in Our Leaders.
            </Text>
          </View>
        </View>
      ) : (
        <LeaderMemberPicker scope="organization" selectedProfileId={profileId} onSelect={selectCandidate} />
      );
    }

    if (step === 1) {
      return (
        <View style={styles.stepBody}>
          <InputField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Leader display name" />
          <InputField label="Role title" value={roleTitle} onChangeText={setRoleTitle} placeholder="Lead Pastor, Worship Director…" />
          <InputField label="Ministry (optional)" value={ministry} onChangeText={setMinistry} placeholder="Pastoral Care, Youth, Worship…" />
          <InputField label="Short biography" value={shortBio} onChangeText={setShortBio} multiline numberOfLines={5} placeholder="A concise ministry introduction…" />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepBody}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LEADER PORTRAIT</Text>
          <Pressable
            onPress={() => void choosePortrait()}
            style={[styles.photoPicker, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
          >
            {portrait?.uri || portraitUrl ? (
              <Image source={{ uri: portrait?.uri || portraitUrl }} style={styles.photoPreview} />
            ) : (
              <View style={[styles.photoFallback, { backgroundColor: colors.primarySoft }]}>
                <Icon name="person-outline" size={28} color={colors.interactive} />
              </View>
            )}
            <View style={styles.flex}>
              <Text style={[styles.photoTitle, { color: colors.text }]}>
                {portrait ? 'New portrait selected' : portraitUrl ? 'Current leader photo' : 'Choose portrait'}
              </Text>
              <Text style={[styles.photoHint, { color: colors.textMuted }]}>
                The member’s profile photo is used by default. Choose another portrait only when needed.
              </Text>
            </View>
            <Icon name="image-outline" size={20} color={colors.interactive} />
          </Pressable>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>OUR LEADERS</Text>
          <View style={styles.chips}>
            <Chip label="Church directory only" selected={!featurePublicly} onPress={() => setFeaturePublicly(false)} />
            <Chip label="Show in Our Leaders" selected={featurePublicly} onPress={() => setFeaturePublicly(true)} />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FOUNDER</Text>
          <View style={styles.chips}>
            <Chip label="Founder" selected={founder} onPress={() => setFounder(true)} />
            <Chip label="Not founder" selected={!founder} onPress={() => setFounder(false)} />
          </View>

          {editing ? (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text>
              <View style={styles.chips}>
                <Chip label="Active" selected={active} onPress={() => setActive(true)} />
                <Chip label="Inactive" selected={!active} onPress={() => setActive(false)} />
              </View>
            </>
          ) : null}
        </View>
      );
    }

    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <View style={styles.reviewIdentity}>
          {portrait?.uri || portraitUrl ? (
            <Image source={{ uri: portrait?.uri || portraitUrl }} style={styles.reviewPortrait} />
          ) : (
            <View style={[styles.reviewPortraitFallback, { backgroundColor: colors.primarySoft }]}>
              <Icon name="person" size={24} color={colors.interactive} />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>{displayName || 'Leader'}</Text>
            <Text style={[styles.reviewRole, { color: colors.interactive }]}>{roleTitle || 'Role title'}</Text>
            {ministry ? <Text style={[styles.reviewMeta, { color: colors.textMuted }]}>{ministry}</Text> : null}
          </View>
        </View>
        {shortBio ? <Text style={[styles.reviewBio, { color: colors.textSecondary }]}>{shortBio}</Text> : null}
        <View style={styles.reviewBadges}>
          <Badge label={featurePublicly ? 'OUR LEADERS' : 'CHURCH DIRECTORY'} variant={featurePublicly ? 'primary' : 'neutral'} />
          {founder ? <Badge label="FOUNDER" variant="active" /> : null}
          {editing && !active ? <Badge label="INACTIVE" variant="neutral" /> : null}
        </View>
      </View>
    );
  };

  if (!organization) {
    return <EmptyState title="Choose a church" message="Choose a church before managing Our Leaders." iconName="business-outline" />;
  }

  if (!access.accessReady) {
    return <View style={styles.body}><Skeleton height={110} count={3} /></View>;
  }

  if (!access.canManageLeadership) {
    return <EmptyState title="Our Leaders management unavailable" message="Only authorized church leadership roles can add or edit leaders." iconName="lock-closed-outline" />;
  }

  const list = leaders.data ?? [];

  return (
    <>
      <View style={styles.body}>
        {success ? (
          <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <Icon name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.noticeText, { color: colors.success }]}>{success}</Text>
          </View>
        ) : null}

        <View style={[styles.ruleCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
          <Icon name="people-circle-outline" size={20} color={colors.interactive} />
          <View style={styles.flex}>
            <Text style={[styles.ruleTitle, { color: colors.text }]}>Manage Our Leaders</Text>
            <Text style={[styles.ruleText, { color: colors.textSecondary }]}>
              Choose leaders from existing COT members, then set their title, biography, photo and whether they appear publicly.
            </Text>
          </View>
        </View>

        <SectionHeader
          title="Our Leaders"
          badge={list.length}
          subtitle="Church leadership profiles"
          actionLabel="Add leader"
          onAction={openCreate}
        />

        {leaders.loading && !leaders.data ? (
          <Skeleton height={104} count={3} />
        ) : leaders.error && !leaders.data ? (
          <ResourceError message={leaders.error} retry={leaders.refresh} />
        ) : list.length ? (
          list.map((leader) => (
            <View key={leader.id} style={[styles.leaderRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={styles.flex}>
                <LeaderCard leader={leader} variant="standard" />
                <View style={styles.badges}>
                  <Badge label={leader.is_active === false ? 'INACTIVE' : 'ACTIVE'} variant={leader.is_active === false ? 'neutral' : 'active'} />
                  {leader.is_featured_public ? <Badge label="OUR LEADERS" variant="primary" /> : null}
                </View>
              </View>
              <Button label="Edit" onPress={() => openEdit(leader)} variant="outline" size="sm" />
            </View>
          ))
        ) : (
          <EmptyState
            title="No leaders listed yet"
            message="Choose church members and add the leaders who serve here."
            iconName="people-outline"
            actionLabel="Add leader"
            onAction={openCreate}
          />
        )}
      </View>

      <BottomSheet
        visible={open}
        onClose={close}
        title={editing ? 'Edit leader' : 'Add leader'}
        subtitle={organization.name}
        maxHeightPercent={96}
      >
        {error ? (
          <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.live} />
            <Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text>
          </View>
        ) : null}
        <ProgressiveFlow
          steps={STEPS}
          currentStep={step}
          onStepChange={setStep}
          onBack={step === 0 ? close : () => setStep((value) => Math.max(0, value - 1))}
          onNext={next}
          onComplete={() => void save()}
          canContinue={canContinue()}
          busy={saving}
          completeLabel={editing ? 'Save changes' : 'Add leader'}
        >
          {renderStep()}
        </ProgressiveFlow>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  ruleCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  ruleTitle: { fontSize: 12.5, fontWeight: '900' },
  ruleText: { fontSize: 10.5, lineHeight: 16, marginTop: 2 },
  leaderRow: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  linkedCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkedTitle: { fontSize: 12.5, fontWeight: '900' },
  linkedText: { fontSize: 10.5, lineHeight: 16, marginTop: 2 },
  stepBody: { gap: spacing.md },
  fieldLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photoPicker: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photoPreview: { width: 64, height: 64, borderRadius: 18 },
  photoFallback: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  photoTitle: { fontSize: 12.5, fontWeight: '900' },
  photoHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  reviewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  reviewIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewPortrait: { width: 70, height: 70, borderRadius: 20 },
  reviewPortraitFallback: { width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reviewTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  reviewRole: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  reviewMeta: { fontSize: 10.5, marginTop: 2 },
  reviewBio: { fontSize: 11.5, lineHeight: 18 },
  reviewBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
