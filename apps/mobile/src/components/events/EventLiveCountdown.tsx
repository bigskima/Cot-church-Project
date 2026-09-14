import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

type CountdownState = {
  phase: 'upcoming' | 'live' | 'ended' | 'cancelled' | 'unknown';
  prefix: string;
  value: string;
  accessibilityLabel: string;
};

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parseTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatRemaining(milliseconds: number, compact: boolean) {
  const remaining = Math.max(0, milliseconds);
  const days = Math.floor(remaining / DAY);
  const hours = Math.floor((remaining % DAY) / HOUR);
  const minutes = Math.floor((remaining % HOUR) / MINUTE);
  const seconds = Math.floor((remaining % MINUTE) / SECOND);
  const pad = (value: number) => String(value).padStart(2, '0');

  if (compact) {
    if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
    if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    return `${minutes}m ${pad(seconds)}s`;
  }

  return `${pad(days)}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
}

function buildCountdownState({
  now,
  start,
  end,
  status,
  compact,
}: {
  now: number;
  start: number | null;
  end: number | null;
  status?: string | null;
  compact: boolean;
}): CountdownState {
  const normalizedStatus = status?.toLowerCase();
  if (normalizedStatus === 'cancelled') {
    return {
      phase: 'cancelled',
      prefix: '',
      value: 'Event cancelled',
      accessibilityLabel: 'Event cancelled',
    };
  }

  if (normalizedStatus === 'completed' || normalizedStatus === 'archived') {
    return {
      phase: 'ended',
      prefix: '',
      value: 'Event ended',
      accessibilityLabel: 'Event ended',
    };
  }

  if (!start) {
    return {
      phase: 'unknown',
      prefix: '',
      value: 'Time to be announced',
      accessibilityLabel: 'Event time to be announced',
    };
  }

  if (now < start) {
    const remaining = formatRemaining(start - now, compact);
    return {
      phase: 'upcoming',
      prefix: 'Starts in',
      value: remaining,
      accessibilityLabel: `Event starts in ${remaining}`,
    };
  }

  if (!end || now < end) {
    if (end) {
      const remaining = formatRemaining(end - now, compact);
      return {
        phase: 'live',
        prefix: 'LIVE NOW',
        value: `Ends in ${remaining}`,
        accessibilityLabel: `Event is live now and ends in ${remaining}`,
      };
    }

    return {
      phase: 'live',
      prefix: 'LIVE NOW',
      value: 'Happening now',
      accessibilityLabel: 'Event is live now',
    };
  }

  return {
    phase: 'ended',
    prefix: '',
    value: 'Event ended',
    accessibilityLabel: 'Event ended',
  };
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
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), SECOND);
    return () => clearInterval(interval);
  }, [startsAt, endsAt, status]);

  const state = buildCountdownState({ now, start, end, status, compact });
  if (!showEnded && state.phase === 'ended') return null;

  const isLive = state.phase === 'live';
  const isInactive = state.phase === 'ended' || state.phase === 'cancelled' || state.phase === 'unknown';
  const foreground = isLive ? colors.live : isInactive ? colors.textMuted : colors.interactive;
  const background = isLive ? colors.liveSoft : isInactive ? colors.bgSecondary : colors.primarySoft;
  const border = isLive ? colors.live : isInactive ? colors.borderSubtle : colors.primarySoftStrong;

  return (
    <View
      style={[
        styles.container,
        compact && styles.compactContainer,
        { backgroundColor: background, borderColor: border },
      ]}
      accessibilityLabel={state.accessibilityLabel}
    >
      <Icon
        name={isLive ? 'radio-outline' : state.phase === 'upcoming' ? 'time-outline' : 'calendar-outline'}
        size={compact ? 13 : 16}
        color={foreground}
      />
      <View style={styles.copy}>
        {state.prefix ? (
          <Text style={[styles.prefix, compact && styles.compactPrefix, { color: foreground }]}>{state.prefix}</Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={[styles.value, compact && styles.compactValue, { color: foreground }]}
        >
          {state.value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compactContainer: {
    minHeight: 30,
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    gap: 6,
  },
  copy: {
    flexShrink: 1,
    minWidth: 0,
  },
  prefix: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  compactPrefix: {
    fontSize: 9,
    lineHeight: 11,
  },
  value: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  compactValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
});
