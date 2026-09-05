import React from 'react';
import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import {
  Button,
  Chip,
  Icon,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { mode, signOut } = useSession();
  const { preference, setPreference, colors } = useTheme();
  const appVersion = Constants.expoConfig?.version ?? 'Development build';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(tabs)/home');
  };

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
            title="Settings"
            kicker="APP"
            subtitle="Appearance, information and account actions."
            showBack
          />
        </View>

        <View style={styles.body}>
          {/* Appearance Settings */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.cardHeader}>
              <Icon name="color-palette-outline" size={20} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance</Text>
            </View>

            <View style={styles.themeChips}>
              <Chip
                label="System"
                selected={preference === 'system'}
                onPress={() => setPreference('system')}
              />
              <Chip
                label="Light"
                selected={preference === 'light'}
                onPress={() => setPreference('light')}
              />
              <Chip
                label="Dark"
                selected={preference === 'dark'}
                onPress={() => setPreference('dark')}
              />
            </View>
          </View>

          {/* Account Security & Support */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.cardHeader}>
              <Icon name="shield-checkmark-outline" size={20} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>About & support</Text>
            </View>

            <Pressable
              onPress={() => router.push('/church-story')}
              style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            >
              <View style={styles.menuLeft}>
                <Icon name="information-circle-outline" size={18} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>About City of Transformation</Text>
              </View>
              <Icon name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <Icon name="code-slash-outline" size={18} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>App version</Text>
              </View>
              <Text style={[styles.versionTag, { color: colors.textMuted }]}>
                {appVersion === 'Development build' ? appVersion : `v${appVersion}`}
              </Text>
            </View>
          </View>

          {/* Sign Out Button */}
          {mode !== 'visitor' ? (
            <Button
              label="Sign out"
              onPress={handleSignOut}
              variant="outline"
              size="lg"
              style={{ marginTop: spacing.md, borderColor: colors.live }}
              icon={<Icon name="log-out-outline" size={18} color={colors.live} />}
            />
          ) : (
            <Button
              label="Sign in"
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/settings' } } as any)}
              variant="primary"
              size="lg"
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  themeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingVertical: spacing.sm,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
  },
  versionTag: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.992 }],
  },
});
