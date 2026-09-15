import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

const HIDDEN_PREFIXES = ['/onboarding', '/(auth)', '/login', '/signup'];
const HIDDEN_EXACT = new Set(['/assistant']);

export function CotGlobalActions() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { mode, accessReady, context } = useSession();

  if (mode !== 'authenticated' || !accessReady) return null;
  if (HIDDEN_EXACT.has(pathname) || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const expressionId = context?.expression?.id ?? undefined;
  const onGeneralHome = pathname === '/general' || pathname === '/general/';
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10) + (pathname.startsWith('/general') ? 84 : 18);

  const openAssistant = () => {
    router.push({
      pathname: '/assistant',
      params: {
        returnTo: pathname,
        scope: expressionId ? 'expression' : 'general',
        ...(expressionId ? { expressionId } : {}),
      },
    } as any);
  };

  const openNotifications = () => {
    router.push((expressionId ? `/expressions/${expressionId}/notifications` : '/general/notifications') as any);
  };

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom }]}> 
      {!onGeneralHome ? (
        <Pressable
          onPress={openNotifications}
          accessibilityRole="button"
          accessibilityLabel={expressionId ? `Open ${context?.expression?.name ?? 'Expression'} notifications` : 'Open notifications'}
          style={({ pressed }) => [styles.secondary, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}
        >
          <Icon name="notifications-outline" size={20} color={colors.text} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={openAssistant}
        accessibilityRole="button"
        accessibilityLabel={expressionId ? `Ask COT AI about ${context?.expression?.name ?? 'this Expression'}` : 'Ask COT AI'}
        style={({ pressed }) => [styles.primary, { backgroundColor: colors.interactive, borderColor: colors.primarySoftStrong }, shadows.floating, pressed && styles.pressed]}
      >
        <Icon name="sparkles" size={23} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', right: spacing.md, zIndex: 80, alignItems: 'center', gap: 8 },
  primary: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondary: { width: 42, height: 42, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
});
