import React from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import {
  loadFloatingActionsPreference,
  saveFloatingActionsPreference,
  subscribeFloatingActionsPreference,
  type FloatingActionsPreference,
} from './floatingActionsPreference';

const HIDDEN_PREFIXES = ['/onboarding', '/(auth)', '/login', '/signup'];
const HIDDEN_EXACT = new Set(['/assistant']);
type Point = { x: number; y: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function clampPoint(value: Point, bounds: Bounds): Point {
  return {
    x: Math.max(bounds.minX, Math.min(value.x, bounds.maxX)),
    y: Math.max(bounds.minY, Math.min(value.y, bounds.maxY)),
  };
}

export function CotGlobalActions() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const { mode, accessReady, context } = useSession();
  const [hidden, setHidden] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const pan = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const positionRef = React.useRef<Point>({ x: 0, y: 0 });
  const hiddenRef = React.useRef(false);
  hiddenRef.current = hidden;

  const expressionId = context?.expression?.id ?? undefined;
  const onGeneralHome = pathname === '/general' || pathname === '/general/';
  const dockWidth = onGeneralHome ? 104 : 148;
  const dockHeight = 54;
  const tabOffset = pathname.startsWith('/general') ? 84 : 18;
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10) + tabOffset;
  const safeTop = Math.max(insets.top, 12) + spacing.sm;
  const bounds: Bounds = {
    minX: spacing.sm,
    maxX: Math.max(spacing.sm, width - dockWidth - spacing.sm),
    minY: safeTop,
    maxY: Math.max(safeTop, height - safeBottom - dockHeight),
  };
  const boundsRef = React.useRef(bounds);
  boundsRef.current = bounds;

  const persist = React.useCallback((point: Point, nextHidden = hiddenRef.current) => {
    void saveFloatingActionsPreference({ ...point, hidden: nextHidden });
  }, []);

  const settle = React.useCallback((gesture: { dx: number; dy: number }) => {
    const raw = {
      x: positionRef.current.x + gesture.dx,
      y: positionRef.current.y + gesture.dy,
    };
    pan.flattenOffset();
    const next = clampPoint(raw, boundsRef.current);
    positionRef.current = next;
    pan.setValue(next);
    persist(next);
  }, [pan, persist]);

  const panResponder = React.useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5
    ),
    onPanResponderGrant: () => {
      pan.setOffset(positionRef.current);
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (_, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => settle(gesture),
    onPanResponderTerminate: (_, gesture) => settle(gesture),
    onPanResponderTerminationRequest: () => false,
  })).current;

  React.useEffect(() => {
    let active = true;

    const applyPreference = (value: FloatingActionsPreference) => {
      if (!active) return;
      const fallback = { x: boundsRef.current.maxX, y: boundsRef.current.maxY };
      const initial = clampPoint({
        x: typeof value.x === 'number' ? value.x : fallback.x,
        y: typeof value.y === 'number' ? value.y : fallback.y,
      }, boundsRef.current);
      positionRef.current = initial;
      pan.setValue(initial);
      setHidden(value.hidden);
      setReady(true);
    };

    void loadFloatingActionsPreference().then(applyPreference);
    const unsubscribe = subscribeFloatingActionsPreference(applyPreference);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [pan]);

  React.useEffect(() => {
    if (!ready || hidden) return;
    const next = clampPoint(positionRef.current, bounds);
    positionRef.current = next;
    pan.setValue(next);
    persist(next, false);
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, hidden, pan, persist, ready]);

  if (mode !== 'authenticated' || !accessReady || !ready || hidden) return null;
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

  const hideMenu = () => {
    setHidden(true);
    persist(positionRef.current, true);
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Floating COT controls. Drag anywhere to move."
        style={[
          styles.root,
          { width: dockWidth, transform: pan.getTranslateTransform() },
        ]}
      >
        <View style={[styles.dock, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }, shadows.floating]}>
          <Pressable
            onPress={openAssistant}
            accessibilityRole="button"
            accessibilityLabel={expressionId ? `Ask COT AI about ${context?.expression?.name ?? 'this Expression'}` : 'Ask COT AI'}
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.interactive }, pressed && styles.pressed]}
          >
            <Icon name="chatbubble-ellipses" size={21} color="#FFFFFF" />
          </Pressable>

          {!onGeneralHome ? (
            <Pressable
              onPress={openNotifications}
              accessibilityRole="button"
              accessibilityLabel={expressionId ? `Open ${context?.expression?.name ?? 'Expression'} notifications` : 'Open notifications'}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Icon name="notifications-outline" size={18} color={colors.text} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={hideMenu}
            accessibilityRole="button"
            accessibilityLabel="Hide floating COT controls"
            accessibilityHint="Restore them later from your account screen."
            style={({ pressed }) => [styles.hideButton, pressed && styles.pressed]}
          >
            <Icon name="eye-off-outline" size={17} color={colors.textSecondary} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 80 },
  root: { position: 'absolute', left: 0, top: 0, height: 54 },
  dock: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  primary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideButton: {
    width: 34,
    height: 38,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
