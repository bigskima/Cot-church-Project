import React from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutRectangle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type TourScope = 'general' | 'expression';
type TourPlacement = 'auto' | 'above' | 'below' | 'center';

type TourStep = {
  id: string;
  order: number;
  targetKey: string;
  routeTemplate: string;
  title: string;
  body: string;
  icon: string;
  placement: TourPlacement;
};

type TourPayload = {
  active: boolean;
  eligible: boolean;
  onboardingReady: boolean;
  experience: {
    id: string;
    scope: TourScope;
    version: string;
    title: string;
    subtitle: string;
    autoStart: boolean;
  } | null;
  steps: TourStep[];
  progress: {
    currentStep: number;
    completedAt: string | null;
    snoozedUntil: string | null;
    neverRemind: boolean;
  } | null;
};

type AnchorRegistration = {
  ref: React.RefObject<View | null>;
  reveal?: () => void | Promise<void>;
};

type ActiveTour = {
  payload: TourPayload;
  expressionId?: string;
  manual: boolean;
};

type TourContextValue = {
  registerAnchor: (key: string, anchor: AnchorRegistration) => () => void;
  startTour: (scope: TourScope, expressionId?: string) => Promise<void>;
  active: boolean;
};

const TourContext = React.createContext<TourContextValue | null>(null);

function resolveRoute(template: string, expressionId?: string) {
  return template.replaceAll('{expressionId}', expressionId ?? '');
}

function scopeFromPath(pathname: string): { scope: TourScope; expressionId?: string } | null {
  const expressionMatch = pathname.match(/^\/expressions\/([^/]+)/);
  if (expressionMatch?.[1]) return { scope: 'expression', expressionId: expressionMatch[1] };
  if (pathname.startsWith('/general')) return { scope: 'general' };
  return null;
}

function sameRoute(pathname: string, route: string) {
  const clean = (value: string) => value.replace(/\/+$/, '') || '/';
  return clean(pathname) === clean(route);
}

function clampRect(rect: LayoutRectangle, screenWidth: number, screenHeight: number) {
  const pad = 6;
  const x = Math.max(8, rect.x - pad);
  const y = Math.max(8, rect.y - pad);
  const right = Math.min(screenWidth - 8, rect.x + rect.width + pad);
  const bottom = Math.min(screenHeight - 8, rect.y + rect.height + pad);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

function routeSpotlight(targetKey: string, width: number, height: number): LayoutRectangle {
  const horizontal = Math.max(12, Math.min(24, width * 0.035));
  if (targetKey.includes('.top') || targetKey.includes(':top')) {
    return { x: horizontal, y: 92, width: Math.max(1, width - horizontal * 2), height: Math.min(210, height * 0.27) };
  }
  if (targetKey.includes('.bottom') || targetKey.includes(':bottom')) {
    const boxHeight = Math.min(190, height * 0.24);
    return { x: horizontal, y: Math.max(90, height - boxHeight - 92), width: Math.max(1, width - horizontal * 2), height: boxHeight };
  }
  return {
    x: horizontal,
    y: Math.max(82, height * 0.14),
    width: Math.max(1, width - horizontal * 2),
    height: Math.max(150, Math.min(height * 0.48, 430)),
  };
}

export function AppTourProvider({ children }: React.PropsWithChildren) {
  const { api, auth, mode } = useSession();
  const { colors } = useTheme();
  const pathname = usePathname();
  const anchors = React.useRef(new Map<string, AnchorRegistration>());
  const attempted = React.useRef(new Set<string>());
  const navigatingTo = React.useRef<string | null>(null);
  const [tour, setTour] = React.useState<ActiveTour | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<LayoutRectangle | null>(null);
  const [targetUnavailable, setTargetUnavailable] = React.useState(false);
  const [coachHeight, setCoachHeight] = React.useState(210);
  const [showOptions, setShowOptions] = React.useState(false);
  const [customDays, setCustomDays] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const accessToken = auth?.session.accessToken ?? null;

  const registerAnchor = React.useCallback((key: string, anchor: AnchorRegistration) => {
    anchors.current.set(key, anchor);
    return () => {
      const current = anchors.current.get(key);
      if (current === anchor) anchors.current.delete(key);
    };
  }, []);

  const requestTour = React.useCallback(async (scope: TourScope, expressionId?: string, manual = false) => {
    const params = new URLSearchParams({ scope });
    if (expressionId) params.set('expressionId', expressionId);
    if (manual) params.set('manual', '1');
    return api.request<TourPayload>(`app-tour?${params.toString()}`, { context: 'public' });
  }, [api]);

  const postTour = React.useCallback(async (
    action: 'start' | 'restart' | 'advance' | 'complete' | 'snooze' | 'never',
    payload: ActiveTour,
    extra: Record<string, unknown> = {},
  ) => {
    if (!payload.payload.experience) return null;
    return api.request<TourPayload>('app-tour', {
      method: 'POST',
      context: 'public',
      feedback: false,
      body: JSON.stringify({
        action,
        scope: payload.payload.experience.scope,
        experienceId: payload.payload.experience.id,
        expressionId: payload.expressionId,
        ...extra,
      }),
    });
  }, [api]);

  const activate = React.useCallback(async (payload: TourPayload, expressionId?: string, manual = false) => {
    if (!payload.active || !payload.experience || !payload.steps.length || (!manual && !payload.eligible)) return;
    const activeTour: ActiveTour = { payload, expressionId, manual };
    const nextIndex = manual ? 0 : Math.max(0, Math.min(payload.steps.length - 1, payload.progress?.currentStep ?? 0));
    navigatingTo.current = null;
    setTour(activeTour);
    setStepIndex(nextIndex);
    setShowOptions(false);
    setCustomDays('');
    setError('');
    setTargetRect(null);
    setTargetUnavailable(false);
    try {
      const updated = await postTour(manual ? 'restart' : 'start', activeTour);
      if (updated?.experience && updated.steps.length) {
        setTour((current) => current ? { ...current, payload: updated } : current);
      }
    } catch {
      // The visual guide can still run if recording the start moment fails briefly.
    }
  }, [postTour]);

  const startTour = React.useCallback(async (scope: TourScope, expressionId?: string) => {
    if (mode !== 'authenticated') return;
    setBusy(true);
    setError('');
    try {
      const payload = await requestTour(scope, expressionId, true);
      await activate(payload, expressionId, true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to start the app tour.');
    } finally {
      setBusy(false);
    }
  }, [activate, mode, requestTour]);

  React.useEffect(() => {
    if (mode !== 'authenticated' || !accessToken || tour || pathname.includes('/onboarding') || pathname === '/general/tour') {
      if (mode !== 'authenticated') attempted.current.clear();
      return;
    }
    const scope = scopeFromPath(pathname);
    if (!scope) return;
    const key = `${accessToken}:${scope.scope}:${scope.expressionId ?? 'general'}`;
    if (attempted.current.has(key)) return;
    attempted.current.add(key);

    let cancelled = false;
    const timer = setTimeout(() => {
      void requestTour(scope.scope, scope.expressionId)
        .then(async (payload) => {
          if (cancelled) return;
          if (!payload.onboardingReady) {
            attempted.current.delete(key);
            return;
          }
          if (payload.eligible) await activate(payload, scope.expressionId, false);
        })
        .catch(() => {
          if (!cancelled) attempted.current.delete(key);
        });
    }, 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, activate, mode, pathname, requestTour, tour]);

  const currentStep = tour?.payload.steps[stepIndex] ?? null;
  const currentRoute = currentStep ? resolveRoute(currentStep.routeTemplate, tour?.expressionId) : null;

  const measureCurrentTarget = React.useCallback(async () => {
    if (!currentStep) return;
    const screen = Dimensions.get('window');
    const screenTarget = currentStep.targetKey.startsWith('screen.') || currentStep.targetKey.startsWith('screen:');
    const anchor = anchors.current.get(currentStep.targetKey);
    setTargetUnavailable(false);
    if (!anchor?.ref.current) {
      if (screenTarget) {
        setTargetRect(routeSpotlight(currentStep.targetKey, screen.width, screen.height));
      } else {
        setTargetRect(null);
        setTimeout(() => {
          const delayed = anchors.current.get(currentStep.targetKey)?.ref.current;
          if (!delayed) setTargetUnavailable(true);
          else void measureCurrentTarget();
        }, 950);
      }
      return;
    }
    try {
      await anchor.reveal?.();
    } catch {
      // A reveal callback is an enhancement; measurement can still succeed.
    }
    let attempt = 0;
    const measure = () => {
      const node = anchors.current.get(currentStep.targetKey)?.ref.current;
      if (!node) {
        if (attempt++ < 7) setTimeout(measure, 120);
        else {
          setTargetRect(screenTarget ? routeSpotlight(currentStep.targetKey, screen.width, screen.height) : null);
          setTargetUnavailable(!screenTarget);
        }
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        if ((!width || !height) && attempt++ < 7) {
          setTimeout(measure, 120);
          return;
        }
        if (width && height) {
          setTargetUnavailable(false);
          setTargetRect({ x, y, width, height });
        } else {
          setTargetRect(screenTarget ? routeSpotlight(currentStep.targetKey, screen.width, screen.height) : null);
          setTargetUnavailable(!screenTarget);
        }
      });
    };
    setTimeout(measure, 220);
  }, [currentStep]);

  React.useEffect(() => {
    if (!tour || !currentStep || !currentRoute) return;
    setTargetRect(null);
    setTargetUnavailable(false);
    if (!sameRoute(pathname, currentRoute)) {
      if (navigatingTo.current !== currentRoute) {
        navigatingTo.current = currentRoute;
        router.push(currentRoute as any);
      }
      return;
    }
    navigatingTo.current = null;
    const timer = setTimeout(() => void measureCurrentTarget(), 120);
    return () => clearTimeout(timer);
  }, [currentRoute, currentStep, measureCurrentTarget, pathname, tour]);

  const moveTo = React.useCallback(async (nextIndex: number) => {
    if (!tour) return;
    const bounded = Math.max(0, Math.min(tour.payload.steps.length - 1, nextIndex));
    navigatingTo.current = null;
    setStepIndex(bounded);
    setTargetRect(null);
    setTargetUnavailable(false);
    setError('');
    try {
      await postTour('advance', tour, { stepIndex: bounded });
    } catch {
      // Progress persistence should never trap the user inside the tour.
    }
  }, [postTour, tour]);

  const finish = React.useCallback(async () => {
    if (!tour) return;
    setBusy(true);
    setError('');
    try {
      await postTour('complete', tour);
      setTour(null);
      setTargetRect(null);
      setTargetUnavailable(false);
      navigatingTo.current = null;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to finish the tour right now.');
    } finally {
      setBusy(false);
    }
  }, [postTour, tour]);

  const snooze = React.useCallback(async (days: number) => {
    if (!tour) return;
    setBusy(true);
    setError('');
    try {
      await postTour('snooze', tour, { snoozeDays: days });
      setTour(null);
      setShowOptions(false);
      setTargetRect(null);
      setTargetUnavailable(false);
      navigatingTo.current = null;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save that reminder.');
    } finally {
      setBusy(false);
    }
  }, [postTour, tour]);

  const never = React.useCallback(async () => {
    if (!tour) return;
    setBusy(true);
    setError('');
    try {
      await postTour('never', tour);
      setTour(null);
      setShowOptions(false);
      setTargetRect(null);
      setTargetUnavailable(false);
      navigatingTo.current = null;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save that preference.');
    } finally {
      setBusy(false);
    }
  }, [postTour, tour]);

  const dismissForSession = React.useCallback(() => {
    setTour(null);
    setShowOptions(false);
    setTargetRect(null);
    setTargetUnavailable(false);
    navigatingTo.current = null;
  }, []);

  const contextValue = React.useMemo<TourContextValue>(() => ({ registerAnchor, startTour, active: Boolean(tour) }), [registerAnchor, startTour, tour]);

  const window = Dimensions.get('window');
  const spotlight = targetRect ? clampRect(targetRect, window.width, window.height) : null;
  const cardWidth = Math.min(window.width - 24, 430);
  const requestedPlacement = currentStep?.placement ?? 'auto';
  const useBelow = spotlight && (requestedPlacement === 'below' || (requestedPlacement === 'auto' && spotlight.y < window.height * 0.48));
  let coachTop = Math.max(18, (window.height - coachHeight) / 2);
  if (spotlight && requestedPlacement !== 'center') {
    if (useBelow) coachTop = Math.min(window.height - coachHeight - 18, spotlight.y + spotlight.height + 14);
    else coachTop = Math.max(18, spotlight.y - coachHeight - 14);
  }

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      <Modal visible={Boolean(tour && currentStep)} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setShowOptions(true)}>
        <View style={styles.overlayRoot}>
          {spotlight ? (
            <>
              <View style={[styles.scrim, { left: 0, top: 0, width: window.width, height: spotlight.y }]} />
              <View style={[styles.scrim, { left: 0, top: spotlight.y, width: spotlight.x, height: spotlight.height }]} />
              <View style={[styles.scrim, { left: spotlight.x + spotlight.width, top: spotlight.y, width: Math.max(0, window.width - spotlight.x - spotlight.width), height: spotlight.height }]} />
              <View style={[styles.scrim, { left: 0, top: spotlight.y + spotlight.height, width: window.width, height: Math.max(0, window.height - spotlight.y - spotlight.height) }]} />
              <View pointerEvents="none" style={[styles.spotlightBorder, { left: spotlight.x, top: spotlight.y, width: spotlight.width, height: spotlight.height, borderColor: colors.interactive }]} />
            </>
          ) : <View style={[StyleSheet.absoluteFill, styles.fullScrim]} />}

          {!showOptions ? (
            <View
              onLayout={(event) => setCoachHeight(event.nativeEvent.layout.height)}
              style={[
                styles.coachCard,
                { width: cardWidth, left: (window.width - cardWidth) / 2, top: coachTop, backgroundColor: colors.card, borderColor: colors.borderSubtle },
                shadows.floating,
              ]}
            >
              <View style={styles.coachTopRow}>
                <View style={[styles.coachIcon, { backgroundColor: colors.primarySoft }]}><Icon name={currentStep?.icon as any} size={20} color={colors.interactive} /></View>
                <View style={styles.flex}>
                  <Text style={[styles.tourEyebrow, { color: colors.interactive }]} numberOfLines={1}>{tour?.payload.experience?.title}</Text>
                  <Text style={[styles.stepCount, { color: colors.textMuted }]}>Step {stepIndex + 1} of {tour?.payload.steps.length ?? 0}</Text>
                </View>
                <Pressable onPress={() => setShowOptions(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tour reminder options" style={[styles.closeButton, { backgroundColor: colors.bgSecondary }]}><Icon name="close" size={18} color={colors.textSecondary} /></Pressable>
              </View>
              <Text style={[styles.coachTitle, { color: colors.text }]}>{currentStep?.title}</Text>
              <Text style={[styles.coachBody, { color: colors.textSecondary }]}>{currentStep?.body}</Text>
              {!spotlight ? (
                <Text style={[styles.findingTarget, { color: colors.textMuted }]}>
                  {targetUnavailable
                    ? 'This control is not available in the current layout. Nothing is highlighted so the tour never points at the wrong place.'
                    : 'Opening the right screen and locating this control…'}
                </Text>
              ) : null}
              {error ? <Text style={[styles.errorText, { color: colors.live }]}>{error}</Text> : null}
              <ScrollProgress steps={tour?.payload.steps.length ?? 0} active={stepIndex} activeColor={colors.interactive} idleColor={colors.borderSubtle} />
              <View style={styles.actions}>
                <Pressable onPress={() => void moveTo(stepIndex - 1)} disabled={stepIndex === 0 || busy} style={[styles.secondaryButton, { borderColor: colors.borderSubtle, opacity: stepIndex === 0 ? 0.45 : 1 }]}><Icon name="arrow-back" size={16} color={colors.textSecondary} /><Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Back</Text></Pressable>
                {stepIndex < (tour?.payload.steps.length ?? 1) - 1 ? (
                  <Pressable onPress={() => void moveTo(stepIndex + 1)} disabled={busy} style={[styles.primaryButton, { backgroundColor: colors.interactive }]}><Text style={styles.primaryText}>Next</Text><Icon name="arrow-forward" size={16} color="#fff" /></Pressable>
                ) : (
                  <Pressable onPress={() => void finish()} disabled={busy} style={[styles.primaryButton, { backgroundColor: colors.interactive }]}><Text style={styles.primaryText}>{busy ? 'Saving…' : 'Finish tour'}</Text><Icon name="checkmark" size={16} color="#fff" /></Pressable>
                )}
              </View>
              <Pressable onPress={() => setShowOptions(true)} disabled={busy} style={styles.skipLink}><Text style={[styles.skipText, { color: colors.textMuted }]}>Skip or remind me later</Text></Pressable>
            </View>
          ) : (
            <View style={[styles.optionsCard, { width: cardWidth, left: (window.width - cardWidth) / 2, backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.floating]}>
              <View style={styles.optionsHeader}><View style={[styles.coachIcon, { backgroundColor: colors.primarySoft }]}><Icon name="time-outline" size={20} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.optionsTitle, { color: colors.text }]}>When should COT show this tour again?</Text><Text style={[styles.optionsSubtitle, { color: colors.textMuted }]}>You can always restart it later from You → App tour & help.</Text></View></View>
              <View style={styles.optionGrid}>
                {[
                  { label: 'Tomorrow', days: 1 },
                  { label: 'In 7 days', days: 7 },
                  { label: 'In 14 days', days: 14 },
                  { label: 'In 30 days', days: 30 },
                ].map((item) => <Pressable key={item.days} onPress={() => void snooze(item.days)} disabled={busy} style={[styles.optionButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Text style={[styles.optionText, { color: colors.text }]}>{item.label}</Text></Pressable>)}
              </View>
              <View style={[styles.customRow, { borderColor: colors.borderSubtle }]}><TextInput value={customDays} onChangeText={(value) => setCustomDays(value.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="Custom days" placeholderTextColor={colors.textMuted} style={[styles.customInput, { color: colors.text }]} /><Pressable onPress={() => void snooze(Number(customDays))} disabled={!customDays || Number(customDays) < 1 || Number(customDays) > 365 || busy} style={[styles.customSave, { backgroundColor: colors.interactive, opacity: !customDays || Number(customDays) < 1 || Number(customDays) > 365 ? 0.45 : 1 }]}><Text style={styles.primaryText}>Remind me</Text></Pressable></View>
              {error ? <Text style={[styles.errorText, { color: colors.live }]}>{error}</Text> : null}
              <Pressable onPress={() => void never()} disabled={busy} style={[styles.neverButton, { borderColor: colors.borderSubtle }]}><Icon name="notifications-off-outline" size={16} color={colors.textSecondary} /><Text style={[styles.neverText, { color: colors.textSecondary }]}>Never remind me automatically</Text></Pressable>
              <View style={styles.optionsFooter}><Pressable onPress={() => setShowOptions(false)} disabled={busy} style={styles.keepTouring}><Text style={[styles.keepTouringText, { color: colors.interactive }]}>Keep touring</Text></Pressable><Pressable onPress={dismissForSession} disabled={busy} style={styles.exitNow}><Text style={[styles.exitNowText, { color: colors.textMuted }]}>Exit for now</Text></Pressable></View>
            </View>
          )}
        </View>
      </Modal>
    </TourContext.Provider>
  );
}

function ScrollProgress({ steps, active, activeColor, idleColor }: { steps: number; active: number; activeColor: string; idleColor: string }) {
  const visible = Math.min(steps, 12);
  const page = steps > visible ? Math.floor(active / visible) : 0;
  const start = page * visible;
  const end = Math.min(steps, start + visible);
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: end - start }, (_, offset) => start + offset).map((index) => (
        <View key={index} style={[styles.progressDot, { backgroundColor: index === active ? activeColor : idleColor }, index === active && styles.progressDotActive]} />
      ))}
      {steps > visible ? <Text style={[styles.progressMore, { color: idleColor }]}>{active + 1}/{steps}</Text> : null}
    </View>
  );
}

export function TourAnchor({ targetKey, children, style, reveal }: React.PropsWithChildren<{ targetKey: string; style?: StyleProp<ViewStyle>; reveal?: () => void | Promise<void> }>) {
  const context = React.useContext(TourContext);
  const ref = React.useRef<View>(null);
  React.useEffect(() => context?.registerAnchor(targetKey, { ref, reveal }), [context, reveal, targetKey]);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}

export function useAppTour() {
  const context = React.useContext(TourContext);
  if (!context) throw new Error('useAppTour must be used inside AppTourProvider');
  return context;
}

const styles = StyleSheet.create({
  overlayRoot: { flex: 1 },
  scrim: { position: 'absolute', backgroundColor: 'rgba(1, 7, 16, 0.62)' },
  fullScrim: { backgroundColor: 'rgba(1, 7, 16, 0.62)' },
  spotlightBorder: { position: 'absolute', borderWidth: 2, borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
  coachCard: { position: 'absolute', borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  coachTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coachIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tourEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.7 },
  stepCount: { fontSize: 10, lineHeight: 14, marginTop: 2, fontWeight: '700' },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  coachTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.45, marginTop: spacing.md },
  coachBody: { fontSize: 12.5, lineHeight: 19, marginTop: 7 },
  findingTarget: { fontSize: 10, lineHeight: 14, marginTop: 7, fontWeight: '700' },
  errorText: { fontSize: 10.5, lineHeight: 15, marginTop: spacing.sm, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  progressDot: { width: 6, height: 6, borderRadius: 3 },
  progressDotActive: { width: 18 },
  progressMore: { marginLeft: 3, fontSize: 9, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: { minHeight: 42, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secondaryText: { fontSize: 11, fontWeight: '800' },
  primaryButton: { minHeight: 42, flex: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  primaryText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  skipLink: { minHeight: 34, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  skipText: { fontSize: 10.5, fontWeight: '800' },
  optionsCard: { position: 'absolute', alignSelf: 'center', top: '16%', borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  optionsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  optionsTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  optionsSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: spacing.md },
  optionButton: { minHeight: 40, width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  optionText: { fontSize: 10.5, fontWeight: '800' },
  customRow: { minHeight: 48, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, overflow: 'hidden' },
  customInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 12 },
  customSave: { alignSelf: 'stretch', minWidth: 105, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  neverButton: { minHeight: 44, borderWidth: 1, borderRadius: radius.lg, marginTop: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  neverText: { fontSize: 10.5, fontWeight: '800' },
  optionsFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  keepTouring: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 5 },
  keepTouringText: { fontSize: 10.5, fontWeight: '900' },
  exitNow: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 5 },
  exitNowText: { fontSize: 10.5, fontWeight: '800' },
});
