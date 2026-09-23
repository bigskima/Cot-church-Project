import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Icon } from '@/components';
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
  const [release, setRelease] = React.useState<AppRelease | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [opening, setOpening] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadRelease = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextRelease = await api.request<AppRelease>(
        'public-content?type=app-release&platform=android&channel=testing',
        { context: 'public', feedback: false, timeoutMs: 20_000 },
      );

      if (!nextRelease?.downloadUrl || !Number.isInteger(Number(nextRelease.versionCode))) {
        throw new Error('The latest COT Android testing APK is being prepared. Please check this same link again after the release is published.');
      }

      setRelease(nextRelease);
    } catch (value) {
      setRelease(null);
      setError(value instanceof Error ? value.message : 'The Android download is not available yet.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void loadRelease();
  }, [loadRelease]);

  const openDownload = React.useCallback(async () => {
    if (!release?.downloadUrl || opening) return;
    setOpening(true);
    setError('');
    try {
      await Linking.openURL(release.downloadUrl);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'We could not open the Android download right now.');
    } finally {
      setOpening(false);
    }
  }, [opening, release?.downloadUrl]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <View style={[styles.icon, { backgroundColor: error ? colors.liveSoft : colors.primarySoft }]}>
          <Icon
            name={error ? 'alert-circle-outline' : 'download-outline'}
            size={24}
            color={error ? colors.live : colors.interactive}
          />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {error ? 'Download unavailable' : 'Optional Android download'}
        </Text>

        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          {error
            ? error
            : loading
              ? 'Checking the current COT Android release…'
              : `Version ${release?.versionName || release?.versionCode || ''} is available for testing. Downloading it is optional and COT will continue normally if you skip it.`}
        </Text>

        {release?.releaseNotes && !error ? (
          <Text style={[styles.notes, { color: colors.textMuted }]} numberOfLines={4}>
            {release.releaseNotes}
          </Text>
        ) : null}

        {error ? (
          <Button label="Try again" onPress={() => void loadRelease()} loading={loading} />
        ) : (
          <Button
            label="Download APK"
            onPress={() => void openDownload()}
            loading={loading || opening}
            disabled={loading || !release?.downloadUrl}
          />
        )}
        <Button label="Continue to COT" variant="outline" onPress={() => router.replace('/general' as any)} />

        <Text style={[styles.helper, { color: colors.textMuted }]}>
          COT never requires this APK download to continue using the web app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, minHeight: 220, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  icon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900', textAlign: 'center' },
  copy: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 320 },
  notes: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', maxWidth: 330 },
  helper: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', maxWidth: 320, marginTop: spacing.xs },
});
