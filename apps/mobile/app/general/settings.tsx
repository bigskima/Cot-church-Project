import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AccountSettingsScreen from '../(tabs)/profile/settings';
import { Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export default function GeneralAccountSettingsRoute() {
  const { colors } = useTheme();
  return (
    <View style={styles.screen}>
      <AccountSettingsScreen />
      <Pressable
        onPress={() => router.push('/general/tour' as any)}
        accessibilityRole="button"
        accessibilityLabel="Open app tour and help"
        style={({ pressed }) => [
          styles.tourButton,
          { backgroundColor: colors.card, borderColor: colors.borderSubtle },
          shadows.floating,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name="navigate-circle-outline" size={20} color={colors.interactive} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>App tour & help</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Restart General COT or an Expression tour</Text>
        </View>
        <Icon name="chevron-forward" size={17} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tourButton: { position: 'absolute', right: spacing.md, bottom: spacing.lg, maxWidth: 330, minHeight: 62, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 12.5, fontWeight: '900' },
  subtitle: { fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
