import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  LeaderCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { putSignedUpload, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { LeadershipProfile } from '@church/types';
import { LeaderMemberPicker, leaderCandidateProfile, type LeaderCandidate } from './LeaderMemberPicker';

type ImageUploadIntent = { signedUploadUrl: string; publicUrl: string };

type Props = {
  scope: 'organization' | 'expression';
};

export default function LeadershipManageExperience({ scope }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const embeddedExpression = pathname.startsWith('/expressions/');
  const { api, context, hasCapability, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organization = context?.organization ?? context?.organizations?.[0];
  const expression = context?.expression;
  const expressionId = scope === 'expression' ? expression?.id ?? '' : '';
  const canManage = scope === 'expression'
    ? Boolean(expressionId) && hasCapability('expression.leadership.manage')
    : hasOrganizationCapability('organization.leadership.manage');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<LeadershipProfile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [ministry, setMinistry] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [portrait, setPortrait] = useState<UploadFile | null>(null);
  const [featurePublicly, setFeaturePublicly] = useState(scope === 'organization');
  const [isFounder, setIsFounder] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const leaders = useResource<LeadershipProfile[]>(
    `leadership:manage:${scope}:${scope === 'expression' ? expressionId || 'none' : organization?.id ?? 'none'}`,
    (signal) => {
      if (!canManage) return Promise.resolve([]);
      if (scope === 'expression') {
        return expressionId
          ? api.request<LeadershipProfile[]>(`church-story?view=leadership&expressionId=${encodeURIComponent(expressionId)}`, { signal })
          : Promise.resolve([]);
      }
      return api.request<LeadershipProfile[]>('church-story?view=leadership-manage', { signal });
    },
  );

  const reset = () => {
    setEditingLeader(null);
    setProfileId(null);
    setDisplayName('');
    setRoleTitle('');
    setMinistry('');
    setShortBio('');
    setPortraitUrl('');
    setPortrait(null);
    setFeaturePublicly(scope === 'organization');
    setIsFounder(false);
    setIsActive(true);
    setErrorMsg('');
  };

  const openCreate = () => {
    if (!canManage) return;
    reset();
    setSuccessMsg('');
    setEditorOpen(true);
  };

  const openEdit = (leader: LeadershipProfile) => {
    if (!canManage) return;
    setEditingLeader(leader);
    setProfileId(leader.profile_id ?? null);
    setDisplayName(leader.display_name ?? '');
    setRoleTitle(leader.role_title ?? '');
    setMinistry(leader.ministry ?? '');
    setShortBio(leader.short_bio ?? '');
    setPortraitUrl(leader.portrait_url ?? '');
    setPortrait(null);
    setFeaturePublicly(leader.is_featured_public === true);
    setIsFounder(leader.is_founder === true);
    setIsActive(leader.is_active !== false);
    setErrorMsg('');
    setSuccessMsg('');
    setEditorOpen(true);
  };

  const selectCandidate = (candidate: LeaderCandidate) => {
    const profile = leaderCandidateProfile(candidate);
    if (!profile) return;
    setProfileId(profile.id);
    setDisplayName(profile.display_name || profile.username || '');
    setPortraitUrl(profile.avatar_url || '');
    setPortrait(null);
    setErrorMsg('');
  };

  const choosePortrait = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setErrorMsg('Allow photo-library access to choose a leader photo.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return setErrorMsg('Choose a JPG, PNG, or WebP photo.');
    setPortrait({ uri: asset.uri, name: asset.fileName || `leader-${Date.now()}.jpg`, mimeType, size: asset.fileSize, file: (asset as any).file });
    setErrorMsg('');
  };

  const save = async () => {
    if (!canManage) return;
    if (!editingLeader && !profileId) return setErrorMsg('Search and select an existing member before adding a leader.');
    if (!displayName.trim() || !roleTitle.trim()) return setErrorMsg('Provide the leader name and role title.');

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let savedPortraitUrl = portraitUrl || null;
      if (portrait) {
        const intent = await api.request<ImageUploadIntent>('church-story', {
          method: 'POST',
          body: JSON.stringify({ action: 'create_portrait_upload', mimeType: portrait.mimeType, ...(scope === 'expression' ? { expressionId } : {}) }),
        });
        await putSignedUpload(intent.signedUploadUrl, portrait);
        savedPortraitUrl = intent.publicUrl;
      }

      const editing = Boolean(editingLeader);
      await api.request('church-story', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...(editing ? { id: editingLeader!.id } : { ...(scope === 'expression' ? { expressionId } : {}), profileId }),
          displayName: displayName.trim(),
          roleTitle: roleTitle.trim(),
          ministry: ministry.trim() || null,
          shortBio: shortBio.trim() || '',
          portraitUrl: savedPortraitUrl,
          isFeaturedPublic: featurePublicly,
          ...(scope === 'organization' ? { isFounder } : {}),
          ...(editing ? { isActive } : {}),
        }),
      });
      setEditorOpen(false);
      reset();
      setSuccessMsg(editing ? 'Leader profile updated.' : 'Member added to the leadership directory.');
      await leaders.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to save this leader.');
    } finally {
      setSaving(false);
    }
  };

  if (scope === 'expression' && !expressionId) {
    return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Enter an Expression first" message="Expression leadership is managed inside the active Expression." iconName="people-outline" /></View>;
  }
  if (scope === 'organization' && !organization) {
    return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Choose a church" message="Choose a church before managing its leadership." iconName="business-outline" /></View>;
  }
  if (!canManage) {
    return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Leadership editing unavailable" message="Only authorized leadership roles can add or edit leaders in this space." iconName="lock-closed-outline" /></View>;
  }

  const leaderList = leaders.data ?? [];
  const placeName = scope === 'expression' ? expression?.name ?? 'this Expression' : organization?.name ?? 'this church';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: embeddedExpression ? spacing.md : insets.top + spacing.sm, paddingBottom: embeddedExpression ? insets.bottom + spacing.xl : insets.bottom + 120 }]}>
        {!embeddedExpression ? (
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <ScreenHeader title={scope === 'expression' ? 'Expression leadership' : 'Church Leadership'} kicker="LEADERSHIP" subtitle={`Choose leaders from existing members of ${placeName}.`} showBack rightAction={<Button label="Add leader" onPress={openCreate} size="sm" />} />
          </View>
        ) : null}

        <View style={styles.body}>
          {successMsg ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text></View> : null}
          <View style={[styles.ruleCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}><Icon name="people-circle-outline" size={19} color={colors.interactive} /><View style={styles.flex}><Text style={[styles.ruleTitle, { color: colors.text }]}>Leaders come from your existing people</Text><Text style={[styles.ruleText, { color: colors.textSecondary }]}>Search a member and add them. Their profile picture becomes the default leader image; upload a different portrait only when needed.</Text></View></View>

          <SectionHeader title="Leadership directory" badge={leaderList.length} subtitle="Images and leadership metadata remain editable" actionLabel="Add" onAction={openCreate} />
          {leaders.loading && !leaders.data ? <Skeleton height={96} count={3} /> : leaders.error && !leaders.data ? <ResourceError message={leaders.error} retry={leaders.refresh} /> : leaderList.length ? leaderList.map((leader) => (
            <View key={leader.id} style={[styles.leaderRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={styles.flex}><LeaderCard leader={leader} variant="standard" /><View style={styles.badges}><Badge label={leader.is_active === false ? 'INACTIVE' : 'ACTIVE'} variant={leader.is_active === false ? 'neutral' : 'active'} />{leader.profile_id ? <Badge label="MEMBER LINKED" variant="primary" /> : <Badge label="LEGACY PROFILE" variant="neutral" />}{leader.is_featured_public ? <Badge label="PUBLIC" variant="primary" /> : null}</View></View>
              <Button label="Edit" onPress={() => openEdit(leader)} variant="outline" size="sm" />
            </View>
          )) : <EmptyState title="No leaders listed yet" message="Search the people in this space and add the leaders who serve here." iconName="people-outline" actionLabel="Add leader" onAction={openCreate} />}
        </View>
      </ScrollView>

      <BottomSheet visible={editorOpen} onClose={() => { if (!saving) { setEditorOpen(false); reset(); } }} title={editingLeader ? 'Edit leader' : 'Add leader'} subtitle={editingLeader ? editingLeader.display_name : placeName} maxHeightPercent={96}>
        <View style={styles.form}>
          {errorMsg ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text></View> : null}
          {!editingLeader || !profileId ? <LeaderMemberPicker scope={scope} expressionId={scope === 'expression' ? expressionId : undefined} selectedProfileId={profileId} onSelect={selectCandidate} /> : (
            <View style={[styles.linkedCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="link-outline" size={18} color={colors.interactive} /><Text style={[styles.linkedText, { color: colors.textSecondary }]}>This leader is linked to a member profile. The leadership title, biography and optional portrait below can still be edited.</Text></View>
          )}
          <InputField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Leader display name" />
          <InputField label="Role title" value={roleTitle} onChangeText={setRoleTitle} placeholder="Lead Pastor, Worship Director…" />
          <InputField label="Ministry (optional)" value={ministry} onChangeText={setMinistry} placeholder="Pastoral Care, Youth, Worship…" />
          <InputField label="Short biography" value={shortBio} onChangeText={setShortBio} multiline numberOfLines={4} placeholder="A short ministry introduction…" />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LEADER IMAGE</Text>
          <Pressable onPress={() => void choosePortrait()} style={[styles.photoPicker, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            {portrait?.uri || portraitUrl ? <Image source={{ uri: portrait?.uri || portraitUrl }} style={styles.photoPreview} /> : <View style={[styles.photoFallback, { backgroundColor: colors.primarySoft }]}><Icon name="person-outline" size={28} color={colors.interactive} /></View>}
            <View style={styles.flex}><Text style={[styles.photoTitle, { color: colors.text }]}>{portrait ? 'Custom portrait selected' : portraitUrl ? 'Current/default member image' : 'No image available'}</Text><Text style={[styles.photoHint, { color: colors.textSecondary }]}>Tap to upload a specific leadership portrait. Otherwise COT keeps the selected member’s profile image.</Text></View><Icon name="image-outline" size={21} color={colors.interactive} />
          </Pressable>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PUBLIC VISIBILITY</Text>
          <View style={styles.chips}><Chip label={scope === 'expression' ? 'Expression only' : 'Church only'} selected={!featurePublicly} onPress={() => setFeaturePublicly(false)} /><Chip label="Also feature publicly" selected={featurePublicly} onPress={() => setFeaturePublicly(true)} /></View>

          {scope === 'organization' ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FOUNDER</Text><View style={styles.chips}><Chip label="Founder" selected={isFounder} onPress={() => setIsFounder(true)} /><Chip label="Not founder" selected={!isFounder} onPress={() => setIsFounder(false)} /></View></> : null}
          {editingLeader ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text><View style={styles.chips}><Chip label="Active" selected={isActive} onPress={() => setIsActive(true)} /><Chip label="Inactive" selected={!isActive} onPress={() => setIsActive(false)} /></View></> : null}
          <Button label={editingLeader ? 'Save changes' : 'Add leader'} onPress={() => void save()} loading={saving} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, content: { flexGrow: 1 }, headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' }, body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 }, bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  ruleCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, ruleTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800' }, ruleText: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  form: { gap: spacing.md }, fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  linkedCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, linkedText: { flex: 1, fontSize: 11, lineHeight: 17 },
  photoPicker: { minHeight: 78, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, photoPreview: { width: 58, height: 58, borderRadius: 18 }, photoFallback: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, photoTitle: { fontSize: 12, fontWeight: '800' }, photoHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
});
