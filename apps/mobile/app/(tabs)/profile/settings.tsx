import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Avatar, Button, Chip, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type ProfilePayload = {
  id: string;
  display_name: string;
  username: string | null;
  birthday: string | null;
  birthday_expression_visible: boolean;
  bio: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  email: string | null;
  verifiedPhoneNumber: string | null;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function inferMimeType(fileName?: string | null) {
  const name = (fileName ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { api, auth, selectContext } = useSession();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayExpressionVisible, setBirthdayExpressionVisible] = useState(true);
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<ProfilePayload>('profile');
      setProfile(data);
      setDisplayName(data.display_name ?? '');
      setUsername(data.username ?? '');
      setBirthday(data.birthday ?? '');
      setBirthdayExpressionVisible(data.birthday_expression_visible !== false);
      setBio(data.bio ?? '');
      setPhoneNumber(data.phone_number ?? '');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load account settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [api]);

  const refreshSessionContext = async () => {
    if (auth?.organizationId) await selectContext(auth.organizationId, auth.branchId);
  };

  const saveProfile = async () => {
    if (!displayName.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api.request<ProfilePayload>('profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: username.trim(),
          birthday: birthday.trim() || null,
          birthdayExpressionVisible,
          bio: bio.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
        }),
      });
      setProfile(updated);
      setBirthdayExpressionVisible(updated.birthday_expression_visible !== false);
      setSuccess('Profile settings saved.');
      await refreshSessionContext();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const chooseProfilePhoto = async () => {
    setPhotoBusy(true);
    setError('');
    setSuccess('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access required', 'Allow photo-library access to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
        setError('Choose an image smaller than 5 MB.');
        return;
      }
      const mimeType = asset.mimeType || inferMimeType(asset.fileName);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        setError('Profile photos must be JPG, PNG, or WebP.');
        return;
      }

      const form = new FormData();
      const webFile = (asset as any).file as File | undefined;
      if (webFile) {
        form.append('file', webFile);
      } else {
        form.append('file', {
          uri: asset.uri,
          name: asset.fileName || `avatar.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
          type: mimeType,
        } as any);
      }

      const response = await api.request<{ avatarUrl: string }>('profile-avatar', { method: 'POST', body: form });
      setProfile((current) => current ? { ...current, avatar_url: response.avatarUrl } : current);
      setSuccess('Profile photo updated.');
      await refreshSessionContext();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update your profile photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeProfilePhoto = async () => {
    setPhotoBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.request<{ avatarUrl: null }>('profile-avatar', { method: 'DELETE' });
      setProfile((current) => current ? { ...current, avatar_url: null } : current);
      setSuccess('Profile photo removed.');
      await refreshSessionContext();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to remove your profile photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 80 }]}>
        <ScreenHeader title="Account Settings" subtitle="Manage your public profile and private account details." showBack />

        {loading && !profile ? (
          <View style={styles.body}><Skeleton height={180} /><Skeleton height={64} count={4} /></View>
        ) : error && !profile ? (
          <View style={styles.body}><ResourceError message={error} retry={() => void loadProfile()} /></View>
        ) : profile ? (
          <View style={styles.body}>
            {success ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{success}</Text></View> : null}
            {error ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text></View> : null}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              <View style={styles.photoRow}>
                <Avatar url={profile.avatar_url} name={profile.display_name} size="lg" />
                <View style={styles.photoActions}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Profile Photo</Text>
                  <Text style={[styles.helper, { color: colors.textMuted }]}>JPG, PNG or WebP · maximum 5 MB</Text>
                  <View style={styles.buttonRow}>
                    <Button label={profile.avatar_url ? 'Change Photo' : 'Choose Photo'} onPress={() => void chooseProfilePhoto()} loading={photoBusy} variant="outline" size="sm" />
                    {profile.avatar_url ? <Button label="Remove" onPress={() => void removeProfilePhoto()} disabled={photoBusy} variant="ghost" size="sm" /> : null}
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Profile Identity</Text>
              <Field label="FULL NAME" value={displayName} onChangeText={setDisplayName} placeholder="Your full name" colors={colors} autoCapitalize="words" />
              <Field label="USERNAME" value={username} onChangeText={setUsername} placeholder="your.username" colors={colors} autoCapitalize="none" />
              <Text style={[styles.helper, { color: colors.textMuted }]}>Username uses 3–30 lowercase letters, numbers, dots or underscores.</Text>
              <Field label="BIRTHDAY" value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" colors={colors} keyboardType="numbers-and-punctuation" />
              <Text style={[styles.helper, { color: colors.textMuted }]}>Your full birth date is private. If enabled below, members of your own Expression see only your birthday month/day and receive birthday reminders.</Text>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EXPRESSION BIRTHDAY VISIBILITY</Text>
              <View style={styles.chips}>
                <Chip label="Share month/day with my Expression" selected={birthdayExpressionVisible} onPress={() => setBirthdayExpressionVisible(true)} />
                <Chip label="Keep birthday hidden" selected={!birthdayExpressionVisible} onPress={() => setBirthdayExpressionVisible(false)} />
              </View>
              <Field label="BIO" value={bio} onChangeText={setBio} placeholder="A short introduction" colors={colors} multiline maxLength={500} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Contact Details</Text>
              <Field label="PROFILE PHONE" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+234..." colors={colors} keyboardType="phone-pad" />
              <View style={[styles.readOnlyRow, { borderColor: colors.borderSubtle }]}>
                <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LOGIN EMAIL</Text><Text style={[styles.readOnlyValue, { color: colors.text }]}>{profile.email || 'Not configured'}</Text></View>
                <Icon name="lock-closed-outline" size={16} color={colors.textMuted} />
              </View>
              {profile.verifiedPhoneNumber ? (
                <View style={[styles.readOnlyRow, { borderColor: colors.borderSubtle }]}>
                  <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>VERIFIED AUTH PHONE</Text><Text style={[styles.readOnlyValue, { color: colors.text }]}>{profile.verifiedPhoneNumber}</Text></View>
                  <Icon name="shield-checkmark-outline" size={16} color={colors.success} />
                </View>
              ) : null}
            </View>

            <Button label="Save Profile" onPress={() => void saveProfile()} loading={saving} disabled={photoBusy} variant="primary" size="lg" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: any;
  multiline?: boolean;
  maxLength?: number;
};

function Field({ label, value, onChangeText, placeholder, colors, autoCapitalize = 'sentences', keyboardType, multiline, maxLength }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} autoCapitalize={autoCapitalize} keyboardType={keyboardType} multiline={multiline} maxLength={maxLength} style={[styles.input, multiline && styles.multiline, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }, bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }, cardTitle: { fontSize: 16, fontWeight: '800' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg }, photoActions: { flex: 1, gap: spacing.xs }, buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  helper: { fontSize: 11, lineHeight: 16 }, fieldGroup: { gap: 5 }, fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.55 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 14 }, multiline: { minHeight: 100, textAlignVertical: 'top' },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.md }, readOnlyValue: { fontSize: 13, fontWeight: '600', marginTop: 3 },
});
