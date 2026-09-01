import React from 'react';
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
  const { mode, signOut, context } = useSession();
  const { preference, setPreference, colors } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

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
          title="App Settings & Preferences"
          subtitle="Customize your appearance, notification alerts, and account security."
          showBack
        />

        <View style={styles.body}>
          {/* Appearance Settings */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="color-palette-outline" size={20} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance & Theme</Text>
            </View>

            <View style={styles.themeChips}>
              <Chip
                label="System Auto"
                selected={preference === 'system'}
                onPress={() => setPreference('system')}
              />
              <Chip
                label="Light Mode"
                selected={preference === 'light'}
                onPress={() => setPreference('light')}
              />
              <Chip
                label="Dark Mode"
                selected={preference === 'dark'}
                onPress={() => setPreference('dark')}
              />
            </View>
          </View>

          {/* Account Security & Support */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="shield-checkmark-outline" size={20} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Security & Support</Text>
            </View>

            <Pressable
              onPress={() => router.push('/church-story')}
              style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            >
              <View style={styles.menuLeft}>
                <Icon name="information-circle-outline" size={18} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>About Church of the Truth</Text>
              </View>
              <Icon name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

            <Pressable
              onPress={() => alert('Platform version 1.0.0 (Production Build)')}
              style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            >
              <View style={styles.menuLeft}>
                <Icon name="code-slash-outline" size={18} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>Platform Version</Text>
              </View>
              <Text style={[styles.versionTag, { color: colors.textMuted }]}>v1.0.0</Text>
            </Pressable>
          </View>

          {/* Sign Out Button */}
          {mode !== 'visitor' ? (
            <Button
              label="Sign Out of Account"
              onPress={handleSignOut}
              variant="outline"
              size="lg"
              style={{ marginTop: spacing.md, borderColor: colors.live }}
              icon={<Icon name="log-out-outline" size={18} color={colors.live} />}
            />
          ) : (
            <Button
              label="Sign In to Member Account"
              onPress={() => router.push('/(auth)/login')}
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
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
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
    fontWeight: '700',
  },
  themeChips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
  },
  versionTag: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
});
