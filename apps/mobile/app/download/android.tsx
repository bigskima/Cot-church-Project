import React from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
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
  releaseNotes?: string | null;
};

export default function AndroidDownloadRoute() {
  const { api } = useSession();
  const { colors } = useTheme();
  const [error, setError] = React.useState('');

  const openDownload = React.useCallback(async () => {
    setError('');
    try {
      const release = await api.request<AppRelease>(
        'public-content?type=app-release&platform=android&channel=testing',
        { context: 'public', feedback: false, timeoutMs: 20_000 },
      );
      if (!release?.downloadUrl || !Number.isInteger(Number(release.versionCode))) {
        throw new Error('The latest COT Android testing APK is being prepared. Please check this same link again after the release is published.');
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace(release.downloadUrl);
        return;
      }
      await Linking.openURL(release.downloadUrl);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'The Android download is not available yet.');
    }
  }, [api]);

  React.useEffect(() => {
    void openDownload();
  }, [openDownload]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        {error ? (
          <>
            <View style={[styles.icon, { backgroundColor: colors.liveSoft }]}>
              <Icon name="alert-circle-outline" size={24} color={colors.live} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Download unavailable</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>{error}</Text>
            <Text onPress={() => void openDownload()} style={[styles.retry, { color: colors.interactive }]}>Try again</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.interactive} />
            <Text style={[styles.title, { color: colors.text }]}>Starting COT download…</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>Your Android APK should begin downloading automatically.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, minHeight: 170, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  icon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900', textAlign: 'center' },
  copy: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 320 },
  retry: { fontSize: 13, fontWeight: '900', marginTop: spacing.sm },
});
