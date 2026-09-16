import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

const HIDDEN_PREFIXES = ['/onboarding', '/(auth)', '/login', '/signup'];
const HIDDEN_EXACT = new Set(['/assistant']);
const STORAGE_KEY = 'cot-floating-actions-v1';
type DockPosition = 'bottom-right' | 'bottom-left' | 'middle-left' | 'middle-right';
type StoredPreference = { position: DockPosition; collapsed: boolean };
const POSITIONS: DockPosition[] = ['bottom-right', 'bottom-left', 'middle-left', 'middle-right'];

function isPosition(value: unknown): value is DockPosition {
  return typeof value === 'string' && POSITIONS.includes(value as DockPosition);
}

async function loadPreference(): Promise<StoredPreference | null> {
  try {
    const raw = Platform.OS === 'web'
      ? typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      : await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredPreference>;
    if (!isPosition(value.position)) return null;
    return { position: value.position, collapsed: value.collapsed === true };
  } catch {
    return null;
  }
}

async function savePreference(value: StoredPreference) {
  try {
    const raw = JSON.stringify(value);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, raw);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, raw);
    }
  } catch {
    // Floating controls remain usable when local preference persistence is unavailable.
  }
}

export function CotGlobalActions() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { mode, accessReady, context } = useSession();
  const [position, setPosition] = React.useState<DockPosition>('bottom-right');
  const [collapsed, setCollapsed] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void loadPreference().then((value) => {
      if (!active) return;
      if (value) {
        setPosition(value.position);
        setCollapsed(value.collapsed);
      }
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (ready) void savePreference({ position, collapsed });
  }, [collapsed, position, ready]);

  if (mode !== 'authenticated' || !accessReady) return null;
  if (HIDDEN_EXACT.has(pathname) || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const expressionId = context?.expression?.id ?? undefined;
  const onGeneralHome = pathname === '/general' || pathname === '/general/';
  const tabOffset = pathname.startsWith('/general') ? 84 : 18;
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10) + tabOffset;
  const safeTop = Math.max(insets.top, 12) + 116;
  const dockStyle = position.startsWith('bottom')
    ? { bottom: safeBottom, ...(position.endsWith('left') ? { left: spacing.md } : { right: spacing.md }) }
    : { top: safeTop, ...(position.endsWith('left') ? { left: spacing.md } : { right: spacing.md }) };

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

  const move = () => {
    const index = POSITIONS.indexOf(position);
    setPosition(POSITIONS[(index + 1) % POSITIONS.length]);
  };

  if (collapsed) {
    return (
      <View pointerEvents="box-none" style={[styles.root, dockStyle]}>
        <Pressable
          onPress={() => setCollapsed(false)}
          accessibilityRole="button"
          accessibilityLabel="Show floating COT actions"
          style={({ pressed }) => [styles.restore, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}
        >
          <Icon name="sparkles-outline" size={17} color={colors.interactive} />
          <Icon name="chevron-up" size={11} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.root, dockStyle]}>
      <View style={[styles.controls, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }, shadows.sm]}>
        <Pressable onPress={move} accessibilityRole="button" accessibilityLabel="Move floating actions" style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
          <Icon name="move-outline" size={15} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => setCollapsed(true)} accessibilityRole="button" accessibilityLabel="Hide floating actions" style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
          <Icon name="chevron-down" size={15} color={colors.textSecondary} />
        </Pressable>
      </View>
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
  root: { position: 'absolute', zIndex: 80, alignItems: 'center', gap: 8 },
  controls: { height: 28, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  controlButton: { width: 31, height: 28, alignItems: 'center', justifyContent: 'center' },
  restore: { minWidth: 42, height: 34, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 7 },
  primary: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondary: { width: 42, height: 42, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
});
