import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, EmptyState, Icon, InputField, ResourceError, Skeleton } from '@/components';
import { ExpressionManagementHeader } from '@/components/expression/ExpressionManagementHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { toUserFacingErrorMessage } from '@/api';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

type ExpressionRecord = {
  id: string;
  name: string;
  code: string;
  timezone?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  is_active?: boolean;
};

function validCode(value: string) {
  return /^[A-Z0-9][A-Z0-9_-]*$/.test(value);
}

export default function ExpressionSettingsScreen() {
  const { api, context, refreshContext } = useSession();
  const { colors } = useTheme();
  const access = useExpressionManagementAccess();
  const id = access.expressionId;
  const expressionName = context?.expression?.name ?? 'This Expression';

  const records = useResource<ExpressionRecord[]>(
    `expression:settings:${id || 'none'}`,
    (signal) => id ? api.request<ExpressionRecord[]>('branches', { signal }) : Promise.resolve([]),
  );

  const current = useMemo(() => (records.data ?? []).find((item) => item.id === id) ?? null, [id, records.data]);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!current) return;
    setName(current.name ?? '');
    setCode(current.code ?? '');
    setTimezone(current.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, [current?.id, current?.name, current?.code, current?.timezone]);

  const dirty = Boolean(current && (
    name.trim() !== current.name ||
    code.trim().toUpperCase() !== current.code ||
    timezone.trim() !== (current.timezone ?? '')
  ));

  const uploadMedia = async (kind: 'avatar' | 'banner') => {
    if (!id || uploading) return;
    setError('');
    setFeedback('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo-library access to choose an Expression image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'banner' ? [3, 1] : [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('kind', kind);
    setUploading(kind);
    try {
      if (Platform.OS === 'web') {
        const blob = await fetch(asset.uri).then((response) => response.blob());
        form.append('file', blob, asset.fileName || `${kind}.${extension}`);
      } else {
        form.append('file', {
          uri: asset.uri,
          name: asset.fileName || `${kind}.${extension}`,
          type: mimeType,
        } as any);
      }
      await api.request('expression-media', { method: 'POST', body: form });
      setFeedback(kind === 'banner' ? 'Expression banner updated.' : 'Expression profile image updated.');
      records.refresh();
      refreshContext();
    } catch (value) {
      setError(toUserFacingErrorMessage(value, 'We couldn’t upload this Expression image. Please try again.'));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();
    const normalizedTimezone = timezone.trim();
    if (!normalizedName) return setError('Enter an Expression name.');
    if (!normalizedCode || !validCode(normalizedCode)) return setError('Use a code made of letters, numbers, hyphens or underscores.');
    if (!normalizedTimezone) return setError('Enter the Expression timezone.');

    setSaving(true);
    setError('');
    setFeedback('');
    try {
      await api.request<ExpressionRecord>(`branches?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: normalizedName, code: normalizedCode, timezone: normalizedTimezone }),
      });
      setFeedback('Expression settings updated.');
      records.refresh();
      refreshContext();
    } catch (value) {
      setError(toUserFacingErrorMessage(value, 'We couldn’t save these Expression settings. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageSettings} expressionId={id} title="Expression settings unavailable">
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <ExpressionManagementHeader
          expressionId={id}
          expressionName={expressionName}
          active="settings"
          title="Settings"
          subtitle="This page updates the Expression name, member code and timezone, plus its banner and profile image."
          icon="settings-outline"
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {feedback ? (
            <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={[styles.noticeText, { color: colors.success }]}>{feedback}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle-outline" size={18} color={colors.live} />
              <Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text>
            </View>
          ) : null}

          {records.loading && !records.data ? (
            <Skeleton height={96} count={3} />
          ) : records.error && !records.data ? (
            <ResourceError message={records.error} retry={records.refresh} />
          ) : !current ? (
            <EmptyState title="Expression settings unavailable" message="We couldn’t load this Expression’s settings. Return to the Expression and try again." iconName="alert-circle-outline" />
          ) : (
            <>
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.sectionHeading}>
                  <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="images-outline" size={19} color={colors.interactive} /></View>
                  <View style={styles.sectionCopy}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Expression appearance</Text>
                    <Text style={[styles.sectionText, { color: colors.textSecondary }]}>A Discord-style banner and profile image identify this Expression everywhere.</Text>
                  </View>
                </View>

                <View style={[styles.identityPreview, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                  <Pressable onPress={() => void uploadMedia('banner')} style={styles.bannerArea} accessibilityRole="button" accessibilityLabel="Change Expression banner">
                    {current.banner_url ? <Image source={{ uri: current.banner_url }} style={styles.bannerImage} resizeMode="cover" /> : <View style={[styles.bannerFallback, { backgroundColor: colors.primarySoft }]}><Icon name="image-outline" size={28} color={colors.interactive} /><Text style={[styles.mediaHint, { color: colors.textSecondary }]}>Add banner</Text></View>}
                    <View style={styles.editChip}><Icon name="camera-outline" size={14} color="#FFFFFF" /><Text style={styles.editChipText}>{uploading === 'banner' ? 'Uploading…' : 'Change banner'}</Text></View>
                  </Pressable>
                  <View style={styles.avatarRow}>
                    <Pressable onPress={() => void uploadMedia('avatar')} style={[styles.avatarShell, { borderColor: colors.card, backgroundColor: colors.cardElevated }]} accessibilityRole="button" accessibilityLabel="Change Expression profile image">
                      {current.avatar_url ? <Image source={{ uri: current.avatar_url }} style={styles.avatarImage} /> : <Icon name="people" size={32} color={colors.interactive} />}
                      <View style={styles.avatarEdit}><Icon name="camera" size={13} color="#FFFFFF" /></View>
                    </Pressable>
                    <View style={styles.previewCopy}><Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>{current.name}</Text><Text style={[styles.previewCode, { color: colors.textSecondary }]}>{current.code}</Text></View>
                  </View>
                </View>
                <Text style={[styles.mediaFootnote, { color: colors.textMuted }]}>JPG, PNG or WebP · up to 8 MB. Tap either image to replace it later.</Text>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.sectionHeading}>
                  <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="id-card-outline" size={19} color={colors.interactive} /></View>
                  <View style={styles.sectionCopy}><Text style={[styles.sectionTitle, { color: colors.text }]}>Identity</Text><Text style={[styles.sectionText, { color: colors.textSecondary }]}>What members see and recognize across this Expression.</Text></View>
                </View>
                <InputField label="Expression name" value={name} onChangeText={setName} placeholder="Expression name" />
                <InputField label="Expression code" value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="AWKA-01" helperText="A short, unique code members can recognize and use when needed." />
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.sectionHeading}>
                  <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="time-outline" size={19} color={colors.interactive} /></View>
                  <View style={styles.sectionCopy}><Text style={[styles.sectionTitle, { color: colors.text }]}>Local time</Text><Text style={[styles.sectionText, { color: colors.textSecondary }]}>Used for events, schedules and date-sensitive member experiences.</Text></View>
                </View>
                <InputField label="Timezone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" autoCorrect={false} placeholder="Africa/Lagos" helperText="Use the IANA timezone for the Expression’s main location." />
              </View>

              <View style={[styles.saveCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                <View style={styles.saveCopy}><Text style={[styles.saveTitle, { color: colors.text }]}>Save changes</Text><Text style={[styles.saveText, { color: colors.textSecondary }]}>{dirty ? 'Review the updated identity and timezone, then save.' : 'There are no unsaved text changes.'}</Text></View>
                <Button label="Save" onPress={() => void save()} loading={saving} disabled={!dirty} size="md" />
              </View>

              <View style={[styles.boundary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
                <Text style={[styles.boundaryText, { color: colors.textSecondary }]}>These images and settings belong only to this Expression. Replacing them does not change General COT branding.</Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </ExpressionManagementGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 780, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 90, gap: spacing.md },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  sectionCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 15, lineHeight: 19, fontWeight: '900' },
  sectionText: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  identityPreview: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  bannerArea: { width: '100%', aspectRatio: 3.1, position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 4 },
  mediaHint: { fontSize: 11, fontWeight: '700' },
  editChip: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', gap: 5, alignItems: 'center' },
  editChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  avatarRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  avatarShell: { width: 70, height: 70, borderRadius: 22, borderWidth: 4, marginTop: -24, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 18 },
  avatarEdit: { position: 'absolute', right: -5, bottom: -5, width: 26, height: 26, borderRadius: 13, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  previewName: { fontSize: 17, fontWeight: '900' },
  previewCode: { fontSize: 11, marginTop: 2 },
  mediaFootnote: { fontSize: 10, lineHeight: 15 },
  saveCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  saveCopy: { flex: 1, minWidth: 0 },
  saveTitle: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  saveText: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  boundary: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  boundaryText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
