import React from 'react';
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type AppRelease = {
  platform: 'android' | 'ios';
  channel: string;
  distribution: 'apk' | 'play_store' | 'app_store';
  downloadUrl: string;
  versionName?: string | null;
  versionCode?: number | null;
  minimumSupportedVersionCode?: number | null;
  releaseNotes?: string | null;
  remindAfterHours?: number | null;
  publishedAt?: string | null;
};

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function nativeBuildVersion() {
  const value = Number(Constants.nativeBuildVersion);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function reminderKey(channel: string, versionCode: number) {
  return `cot-update-reminder:${channel}:${versionCode}`;
}

async function readReminder(key: string) {
  try {
    if (!(await SecureStore.isAvailableAsync())) return null;
    const raw = await SecureStore.getItemAsync(key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function writeReminder(key: string) {
  try {
    if (!(await SecureStore.isAvailableAsync())) return;
    await SecureStore.setItemAsync(key, String(Date.now()));
  } catch {
    // Reminder persistence is best effort; release detection still works.
  }
}

export function AppUpdateBridge() {
  const { api } = useSession();
  const { colors } = useTheme();
  const [release, setRelease] = React.useState<AppRelease | null>(null);
  const [visible, setVisible] = React.useState(false);
  const checking = React.useRef(false);

  const channel = process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL?.trim() || 'testing';
  const installedBuild = nativeBuildVersion();

  const check = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !installedBuild || checking.current) return;
    checking.current = true;
    try {
      const next = await api.request<AppRelease>(
        `public-content?type=app-release&platform=android&channel=${encodeURIComponent(channel)}`,
        { context: 'public', feedback: false, timeoutMs: 12_000 },
      );
      const nextBuild = Number(next.versionCode);
      if (!Number.isInteger(nextBuild) || nextBuild <= installedBuild || !next.downloadUrl) {
        setRelease(null);
        setVisible(false);
        return;
      }

      const minimum = Number(next.minimumSupportedVersionCode);
      const required = Number.isInteger(minimum) && minimum > installedBuild;
      if (required) {
        setRelease(next);
        setVisible(true);
        return;
      }

      const remindHours = Math.max(1, Number(next.remindAfterHours) || 24);
      const lastReminder = await readReminder(reminderKey(channel, nextBuild));
      if (!lastReminder || Date.now() - lastReminder >= remindHours * 60 * 60 * 1000) {
        setRelease(next);
        setVisible(true);
      }
    } catch {
      // Update checks never block app startup or normal use.
    } finally {
      checking.current = false;
    }
  }, [api, channel, installedBuild]);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    void check();
    const interval = setInterval(() => void check(), CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [check]);

  if (Platform.OS !== 'android' || !release) return null;

  const nextBuild = Number(release.versionCode);
  const minimum = Number(release.minimumSupportedVersionCode);
  const required = Boolean(installedBuild && Number.isInteger(minimum) && minimum > installedBuild);
  const storeLabel = release.distribution === 'play_store' ? 'Google Play' : 'COT Android APK';

  const updateNow = async () => {
    if (!release.downloadUrl) return;
    try {
      await Linking.openURL(release.downloadUrl);
    } catch {
      // Keep the prompt visible so the user can retry.
    }
  };

  const later = async () => {
    if (required || !Number.isInteger(nextBuild)) return;
    await writeReminder(reminderKey(channel, nextBuild));
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!required) void later(); }}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="cloud-download-outline" size={25} color={colors.interactive} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {required ? 'COT update required' : 'A new COT update is ready'}
          </Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>
            {required
              ? 'Install the latest version to continue using this COT build safely.'
              : `Version ${release.versionName || nextBuild} is available through ${storeLabel}.`}
          </Text>
          {release.releaseNotes ? <Text style={[styles.notes, { color: colors.textMuted }]} numberOfLines={4}>{release.releaseNotes}</Text> : null}

          <Pressable onPress={() => void updateNow()} style={({ pressed }) => [styles.primary, { backgroundColor: colors.interactive }, pressed && styles.pressed]}>
            <Icon name={release.distribution === 'play_store' ? 'logo-google-playstore' : 'download-outline'} size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>{release.distribution === 'play_store' ? 'Update on Google Play' : 'Download update'}</Text>
          </Pressable>

          {!required ? (
            <Pressable onPress={() => void later()} style={({ pressed }) => [styles.later, { borderColor: colors.borderSubtle }, pressed && styles.pressed]}>
              <Text style={[styles.laterText, { color: colors.textSecondary }]}>Remind me later</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(3,10,20,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.35 },
  copy: { fontSize: 12.5, lineHeight: 19, textAlign: 'center', maxWidth: 330 },
  notes: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', maxWidth: 340, marginBottom: 4 },
  primary: { width: '100%', minHeight: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  primaryText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  later: { width: '100%', minHeight: 44, borderWidth: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontSize: 11.5, fontWeight: '800' },
  pressed: { opacity: 0.78 },
});
