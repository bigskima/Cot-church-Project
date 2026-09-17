import React from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

const HIDDEN_PREFIXES = ['/onboarding', '/(auth)', '/login', '/signup'];
const HIDDEN_EXACT = new Set(['/assistant']);
const STORAGE_KEY = 'cot-floating-actions-v2';
const DOCK_WIDTH = 64;
type Point = { x: number; y: number };
type StoredPreference = Point & { collapsed: boolean };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampPoint(value: Point, bounds: Bounds): Point {
  return {
    x: Math.max(bounds.minX, Math.min(value.x, bounds.maxX)),
    y: Math.max(bounds.minY, Math.min(value.y, bounds.maxY)),
  };
}

async function loadPreference(): Promise<StoredPreference | null> {
  try {
    const raw = Platform.OS === 'web'
      ? typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      : await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredPreference>;
    if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
    return { x: value.x, y: value.y, collapsed: value.collapsed === true };
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
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const { mode, accessReady, context } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const pan = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const positionRef = React.useRef<Point>({ x: 0, y: 0 });
  const collapsedRef = React.useRef(false);
  collapsedRef.current = collapsed;

  const expressionId = context?.expression?.id ?? undefined;
  const onGeneralHome = pathname === '/general' || pathname === '/general/';
  const tabOffset = pathname.startsWith('/general') ? 84 : 18;
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10) + tabOffset;
  const safeTop = Math.max(insets.top, 12) + spacing.sm;
  const dockHeight = collapsed ? 38 : onGeneralHome ? 90 : 140;
  const bounds: Bounds = {
    minX: spacing.sm,
    maxX: Math.max(spacing.sm, width - DOCK_WIDTH - spacing.sm),
    minY: safeTop,
    maxY: Math.max(safeTop, height - safeBottom - dockHeight),
  };
  const boundsRef = React.useRef(bounds);
  boundsRef.current = bounds;

  const panResponder = React.useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => {
      pan.setOffset(positionRef.current);
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (_, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => {
      const raw = {
        x: positionRef.current.x + gesture.dx,
        y: positionRef.current.y + gesture.dy,
      };
      pan.flattenOffset();
      const next = clampPoint(raw, boundsRef.current);
      positionRef.current = next;
      pan.setValue(next);
      void savePreference({ ...next, collapsed: collapsedRef.current });
    },
    onPanResponderTerminate: (_, gesture) => {
      const raw = {
        x: positionRef.current.x + gesture.dx,
        y: positionRef.current.y + gesture.dy,
      };
      pan.flattenOffset();
      const next = clampPoint(raw, boundsRef.current);
      positionRef.current = next;
      pan.setValue(next);
      void savePreference({ ...next, collapsed: collapsedRef.current });
    },
  })).current;

  React.useEffect(() => {
    let active = true;
    void loadPreference().then((value) => {
      if (!active) return;
      const initial = value
        ? clampPoint({ x: value.x, y: value.y }, boundsRef.current)
        : { x: boundsRef.current.maxX, y: boundsRef.current.maxY };
      positionRef.current = initial;
      pan.setValue(initial);
      if (value) setCollapsed(value.collapsed);
      setReady(true);
    });
    return () => { active = false; };
  }, [pan]);

  React.useEffect(() => {
    if (!ready) return;
    const next = clampPoint(positionRef.current, bounds);
    positionRef.current = next;
    pan.setValue(next);
    void savePreference({ ...next, collapsed });
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, collapsed, pan, ready]);

  if (mode !== 'authenticated' || !accessReady || !ready) return null;
  if (HIDDEN_EXACT.has(pathname) || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

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

  if (collapsed) {
    return (
      <View pointerEvents="box-none" style={styles.overlay}>
        <Animated.View style={[styles.root, { transform: pan.getTranslateTransform() }]}>
          <Pressable
            onPress={() => setCollapsed(false)}
            accessibilityRole="button"
            accessibilityLabel="Show floating COT actions"
            style={({ pressed }) => [styles.restore, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}
          >
            <Icon name="chatbubble-ellipses-outline" size={18} color={colors.interactive} />
            <Icon name="chevron-up" size={11} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View style={[styles.root, { transform: pan.getTranslateTransform() }]}>
        <View style={[styles.controls, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View
            {...panResponder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Drag floating COT menu"
            style={styles.dragHandle}
          >
            <Icon name="move-outline" size={16} color={colors.textSecondary} />
          </View>
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
          <Icon name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 80 },
  root: { position: 'absolute', left: 0, top: 0, width: DOCK_WIDTH, alignItems: 'center', gap: 8 },
  controls: { height: 30, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  dragHandle: { width: 33, height: 30, alignItems: 'center', justifyContent: 'center' },
  controlButton: { width: 31, height: 30, alignItems: 'center', justifyContent: 'center' },
  restore: { minWidth: 46, height: 38, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 8 },
  primary: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondary: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
});
