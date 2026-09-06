import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  birthday_public_visible: boolean;
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
  const { api, updateContextProfile } = useSession();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayExpressionVisible, setBirthdayExpressionVisible] = useState(true);
  const [birthdayPublicVisible, setBirthdayPublicVisible] = useState(false);
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState<'identity' | 'privacy' | 'contact'>('identity');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<ProfilePayload>('profile', { context: 'public' });
      setProfile(data);
      setDisplayName(data.display_name ?? '');
      setUsername(data.username ?? '');
      setBirthday(data.birthday ?? '');
      setBirthdayExpressionVisible(data.birthday_expression_visible !== false);
      setBirthdayPublicVisible(data.birthday_public_visible === true);
      setBio(data.bio ?? '');
      setPhoneNumber(data.phone_number ?? '');
      updateContextProfile({
        display_name: data.display_name,
        avatar_url: data.avatar_url ?? undefined,
      });
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load account settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [api]);

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
        context: 'public',
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: username.trim(),
          birthday: birthday.trim() || null,
          birthdayExpressionVisible,
          birthdayPublicVisible,
          bio: bio.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
        }),
      });
      setProfile(updated);
      setBirthdayExpressionVisible(updated.birthday_expression_visible !== false);
      setBirthdayPublicVisible(updated.birthday_public_visible === true);
      updateContextProfile({
        display_name: updated.display_name,
        avatar_url: updated.avatar_url ?? undefined,
      });
      setSuccess('Profile settings saved.');
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
        setError('Photo access is required to choose a profile picture. Allow photo-library access in your device settings and try again.');
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

      const response = await api.request<{ avatarUrl: string }>('profile-avatar', { method: 'POST', context: 'public', body: form });
      setProfile((current) => current ? { ...current, avatar_url: response.avatarUrl } : current);
      updateContextProfile({ avatar_url: response.avatarUrl });
      setSuccess('Profile photo updated.');
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
      await api.request<{ avatarUrl: null }>('profile-avatar', { method: 'DELETE', context: 'public' });
      setProfile((current) => current ? { ...current, avatar_url: null } : current);
      updateContextProfile({ avatar_url: undefined });
      setSuccess('Profile photo removed.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to remove your profile photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 150 }]}>
        <ScreenHeader title="Edit profile" kicker="ACCOUNT" subtitle="Update your identity, privacy and contact details." showBack />

        {loading && !profile ? (
          <View style={styles.body}><Skeleton height={180} /><Skeleton height={64} count={4} /></View>
        ) : error && !profile ? (
          <View style={styles.body}><ResourceError message={error} retry={() => void loadProfile()} /></View>
        ) : profile ? (
          <View style={styles.body}>
            {success ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{success}</Text></View> : null}
            {error ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text></View> : null}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
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

            <View style={[styles.sectionNav, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              {([
                ['identity', 'person-outline', 'Identity'],
                ['privacy', 'shield-checkmark-outline', 'Privacy'],
                ['contact', 'call-outline', 'Contact'],
              ] as const).map(([key, icon, label]) => {
                const selected = activeSection === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setActiveSection(key)}
                    style={({ pressed }) => [
                      styles.sectionTab,
                      selected && { backgroundColor: colors.primarySoft },
                      pressed && styles.sectionTabPressed,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.sectionTabIcon, { backgroundColor: selected ? colors.cardElevated : colors.bgSecondary }]}>
                      <Icon name={icon} size={16} color={selected ? colors.interactive : colors.textMuted} />
                    </View>
                    <Text style={[styles.sectionTabText, { color: selected ? colors.interactive : colors.textSecondary }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {activeSection === 'identity' ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <View style={styles.cardHeadingRow}>
                  <View style={[styles.cardHeadingIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name="person-outline" size={18} color={colors.interactive} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Profile identity</Text>
                    <Text style={[styles.helper, { color: colors.textMuted }]}>How your name and introduction appear around COT.</Text>
                  </View>
                </View>
                <Field label="FULL NAME" value={displayName} onChangeText={setDisplayName} placeholder="Your full name" colors={colors} autoCapitalize="words" />
                <Field label="USERNAME" value={username} onChangeText={setUsername} placeholder="your.username" colors={colors} autoCapitalize="none" />
                <Text style={[styles.helper, { color: colors.textMuted }]}>Username uses 3–30 lowercase letters, numbers, dots or underscores.</Text>
                <Field label="BIO" value={bio} onChangeText={setBio} placeholder="A short introduction" colors={colors} multiline maxLength={500} />
              </View>
            ) : null}

            {activeSection === 'privacy' ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <View style={styles.cardHeadingRow}>
                  <View style={[styles.cardHeadingIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Birthday privacy</Text>
                    <Text style={[styles.helper, { color: colors.textMuted }]}>Your full date stays private. You control whether month/day is shown.</Text>
                  </View>
                </View>
                <Field label="BIRTHDAY" value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" colors={colors} keyboardType="numbers-and-punctuation" />

                <View style={[styles.privacyChoice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={styles.privacyChoiceHeader}>
                    <Icon name="globe-outline" size={17} color={colors.interactive} />
                    <View style={styles.flex}>
                      <Text style={[styles.privacyChoiceTitle, { color: colors.text }]}>General Community</Text>
                      <Text style={[styles.helper, { color: colors.textMuted }]}>Choose whether your month/day can appear publicly.</Text>
                    </View>
                  </View>
                  <View style={styles.chips}>
                    <Chip label="Show month/day" selected={birthdayPublicVisible} onPress={() => setBirthdayPublicVisible(true)} />
                    <Chip label="Keep private" selected={!birthdayPublicVisible} onPress={() => setBirthdayPublicVisible(false)} />
                  </View>
                </View>

                <View style={[styles.privacyChoice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={styles.privacyChoiceHeader}>
                    <Icon name="people-outline" size={17} color={colors.interactive} />
                    <View style={styles.flex}>
                      <Text style={[styles.privacyChoiceTitle, { color: colors.text }]}>My Expression</Text>
                      <Text style={[styles.helper, { color: colors.textMuted }]}>Choose whether members in your Expression can see month/day.</Text>
                    </View>
                  </View>
                  <View style={styles.chips}>
                    <Chip label="Share month/day" selected={birthdayExpressionVisible} onPress={() => setBirthdayExpressionVisible(true)} />
                    <Chip label="Keep private" selected={!birthdayExpressionVisible} onPress={() => setBirthdayExpressionVisible(false)} />
                  </View>
                </View>
              </View>
            ) : null}

            {activeSection === 'contact' ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <View style={styles.cardHeadingRow}>
                  <View style={[styles.cardHeadingIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name="call-outline" size={18} color={colors.interactive} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Contact & sign-in</Text>
                    <Text style={[styles.helper, { color: colors.textMuted }]}>Profile contact can be edited here; authentication identity stays protected.</Text>
                  </View>
                </View>
                <Field label="PROFILE PHONE" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+234..." colors={colors} keyboardType="phone-pad" />
                <View style={[styles.readOnlyRow, { borderColor: colors.borderSubtle }]}>
                  <View style={styles.flex}><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LOGIN EMAIL</Text><Text style={[styles.readOnlyValue, { color: colors.text }]}>{profile.email || 'Not configured'}</Text></View>
                  <View style={[styles.lockIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="lock-closed-outline" size={15} color={colors.textMuted} /></View>
                </View>
                {profile.verifiedPhoneNumber ? (
                  <View style={[styles.readOnlyRow, { borderColor: colors.borderSubtle }]}>
                    <View style={styles.flex}><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>VERIFIED AUTH PHONE</Text><Text style={[styles.readOnlyValue, { color: colors.text }]}>{profile.verifiedPhoneNumber}</Text></View>
                    <View style={[styles.lockIcon, { backgroundColor: colors.successSoft }]}><Icon name="shield-checkmark-outline" size={15} color={colors.success} /></View>
                  </View>
                ) : null}
              </View>
            ) : null}

          </View>
        ) : null}
      </ScrollView>
      {profile ? (
        <View style={[styles.saveBar, { backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.floating]}>
          <Button label="Save changes" onPress={() => void saveProfile()} loading={saving} disabled={photoBusy} variant="primary" size="lg" fullWidth />
        </View>
      ) : null}
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
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} autoCapitalize={autoCapitalize} keyboardType={keyboardType} multiline={multiline} maxLength={maxLength} style={[styles.input, multiline && styles.multiline, { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle, color: colors.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }, cardTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardHeadingIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, photoActions: { flex: 1, gap: spacing.xs }, buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  sectionNav: { flexDirection: 'row', padding: 4, borderWidth: 1, borderRadius: radius.xl, gap: 3 },
  sectionTab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.lg, paddingHorizontal: 4 },
  sectionTabPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  sectionTabIcon: { width: 27, height: 27, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sectionTabText: { fontSize: 10.5, fontWeight: '800' },
  privacyChoice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  privacyChoiceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  privacyChoiceTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  lockIcon: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  helper: { fontSize: 11, lineHeight: 16 }, fieldGroup: { gap: 5 }, fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.55 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 14 }, multiline: { minHeight: 100, textAlignVertical: 'top' },
  saveBar: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.sm },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.md }, readOnlyValue: { fontSize: 13, fontWeight: '600', marginTop: 3 },
});