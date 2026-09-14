import React, { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import { Icon } from '../primitives/Icon';

type EventLiveCountdownProps = {
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
  compact?: boolean;
  showEnded?: boolean;
};

type CountdownPhase = 'upcoming' | 'live' | 'ended' | 'cancelled' | 'unknown';

type CountdownState = {
  phase: CountdownPhase;
  prefix: string;
  accessibilityLabel: string;
  remainingMs: number | null;
};

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type TickSubscriber = (now: number) => void;

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const tickSubscribers = new Set<TickSubscriber>();
let sharedTicker: ReturnType<typeof setInterval> | null = null;
let sharedAppStateSubscription: { remove: () => void } | null = null;

function emitNow() {
  const now = Date.now();
  tickSubscribers.forEach((subscriber) => subscriber(now));
}

function ensureSharedTicker() {
  if (!sharedTicker) sharedTicker = setInterval(emitNow, SECOND);
  if (!sharedAppStateSubscription) {
    sharedAppStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') emitNow();
    });
  }
}

function stopSharedTickerWhenIdle() {
  if (tickSubscribers.size > 0) return;
  if (sharedTicker) {
    clearInterval(sharedTicker);
    sharedTicker = null;
  }
  sharedAppStateSubscription?.remove();
  sharedAppStateSubscription = null;
}

function subscribeToClock(subscriber: TickSubscriber) {
  tickSubscribers.add(subscriber);
  ensureSharedTicker();
  subscriber(Date.now());
  return () => {
    tickSubscribers.delete(subscriber);
    stopSharedTickerWhenIdle();
  };
}

function parseTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function remainingParts(milliseconds: number): CountdownParts {
  const remaining = Math.max(0, milliseconds);
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
  };
}

function compactRemaining(milliseconds: number) {
  const { days, hours, minutes, seconds } = remainingParts(milliseconds);
  const pad = (value: number) => String(value).padStart(2, '0');

  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${minutes}m ${pad(seconds)}s`;
}

function spokenRemaining(milliseconds: number) {
  const { days, hours, minutes, seconds } = remainingParts(milliseconds);
  const parts = [
    days ? `${days} day${days === 1 ? '' : 's'}` : '',
    hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '',
    minutes ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '',
    `${seconds} second${seconds === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.join(', ');
}

function buildCountdownState({
  now,
  start,
  end,
  status,
}: {
  now: number;
  start: number | null;
  end: number | null;
  status?: string | null;
}): CountdownState {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === 'cancelled') {
    return {
      phase: 'cancelled',
      prefix: 'Event cancelled',
      accessibilityLabel: 'Event cancelled',
      remainingMs: null,
    };
  }

  if (normalizedStatus === 'completed' || normalizedStatus === 'archived') {
    return {
      phase: 'ended',
      prefix: 'Event ended',
      accessibilityLabel: 'Event ended',
      remainingMs: null,
    };
  }

  if (start === null) {
    return {
      phase: 'unknown',
      prefix: 'Time to be announced',
      accessibilityLabel: 'Event time to be announced',
      remainingMs: null,
    };
  }

  if (now < start) {
    const remainingMs = start - now;
    return {
      phase: 'upcoming',
      prefix: 'Starts in',
      accessibilityLabel: `Event starts in ${spokenRemaining(remainingMs)}`,
      remainingMs,
    };
  }

  if (end === null || now < end) {
    if (end === null) {
      return {
        phase: 'live',
        prefix: 'LIVE NOW',
        accessibilityLabel: 'Event is live now',
        remainingMs: null,
      };
    }

    const remainingMs = end - now;
    return {
      phase: 'live',
      prefix: 'LIVE NOW · Ends in',
      accessibilityLabel: `Event is live now and ends in ${spokenRemaining(remainingMs)}`,
      remainingMs,
    };
  }

  return {
    phase: 'ended',
    prefix: 'Event ended',
    accessibilityLabel: 'Event ended',
    remainingMs: null,
  };
}

function CountdownUnit({ value, label, foreground, background, border }: {
  value: number;
  label: string;
  foreground: string;
  background: string;
  border: string;
}) {
  return (
    <View style={[styles.unit, { backgroundColor: background, borderColor: border }]}>
      <Text style={[styles.unitValue, { color: foreground }]}>{String(value).padStart(2, '0')}</Text>
      <Text style={[styles.unitLabel, { color: foreground }]}>{label}</Text>
    </View>
  );
}

export function EventLiveCountdown({
  startsAt,
  endsAt,
  status,
  compact = false,
  showEnded = true,
}: EventLiveCountdownProps) {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const start = useMemo(() => parseTimestamp(startsAt), [startsAt]);
  const end = useMemo(() => parseTimestamp(endsAt), [endsAt]);

  useEffect(() => {
    const normalizedStatus = status?.toLowerCase();
    const inactiveStatus = normalizedStatus === 'cancelled' || normalizedStatus === 'completed' || normalizedStatus === 'archived';
    const currentTime = Date.now();
    setNow(currentTime);

    if (start === null || inactiveStatus || (end !== null && currentTime >= end)) return undefined;
    return subscribeToClock(setNow);
  }, [start, end, status]);

  const state = buildCountdownState({ now, start, end, status });
  if (!showEnded && state.phase === 'ended') return null;

  const isLive = state.phase === 'live';
  const isInactive = state.phase === 'ended' || state.phase === 'cancelled' || state.phase === 'unknown';
  const foreground = isLive ? colors.live : isInactive ? colors.textMuted : colors.interactive;
  const background = isLive ? colors.liveSoft : isInactive ? colors.bgSecondary : colors.primarySoft;
  const border = isLive ? colors.live : isInactive ? colors.borderSubtle : colors.primarySoftStrong;
  const parts = state.remainingMs !== null ? remainingParts(state.remainingMs) : null;

  if (compact) {
    const compactValue = state.remainingMs !== null
      ? compactRemaining(state.remainingMs)
      : state.phase === 'live'
        ? 'Happening now'
        : state.prefix;

    return (
      <View
        style={[styles.compactContainer, { backgroundColor: background, borderColor: border }]}
        accessibilityLabel={state.accessibilityLabel}
      >
        <Icon
          name={isLive ? 'radio-outline' : state.phase === 'upcoming' ? 'time-outline' : 'calendar-outline'}
          size={13}
          color={foreground}
        />
        <Text numberOfLines={1} style={[styles.compactText, { color: foreground }]}>
          {state.remainingMs !== null ? `${state.prefix} ${compactValue}` : compactValue}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: background, borderColor: border }]}
      accessibilityLabel={state.accessibilityLabel}
    >
      <View style={styles.headingRow}>
        <View style={[styles.iconBubble, { backgroundColor: colors.card }]}>
          <Icon
            name={isLive ? 'radio-outline' : state.phase === 'upcoming' ? 'time-outline' : 'calendar-outline'}
            size={17}
            color={foreground}
          />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.prefix, { color: foreground }]}>{state.prefix}</Text>
          {state.phase === 'upcoming' ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>Live countdown to the event start</Text>
          ) : state.phase === 'live' ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>This gathering is happening now</Text>
          ) : null}
        </View>
      </View>

      {parts ? (
        <View style={styles.unitsRow}>
          <CountdownUnit value={parts.days} label="DAYS" foreground={foreground} background={colors.card} border={border} />
          <CountdownUnit value={parts.hours} label="HRS" foreground={foreground} background={colors.card} border={border} />
          <CountdownUnit value={parts.minutes} label="MIN" foreground={foreground} background={colors.card} border={border} />
          <CountdownUnit value={parts.seconds} label="SEC" foreground={foreground} background={colors.card} border={border} />
        </View>
      ) : state.phase === 'live' ? (
        <View style={[styles.liveNowPanel, { backgroundColor: colors.card, borderColor: border }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
          <Text style={[styles.liveNowText, { color: foreground }]}>Happening now</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1, minWidth: 0 },
  prefix: { fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 0.55 },
  helper: { marginTop: 2, fontSize: 11.5, lineHeight: 16, fontWeight: '500' },
  unitsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  unit: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  unitLabel: {
    marginTop: 1,
    fontSize: 8.5,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.65,
  },
  liveNowPanel: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  liveNowText: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  compactContainer: {
    minHeight: 30,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    gap: 6,
  },
  compactText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
