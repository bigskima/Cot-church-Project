import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@/components/primitives/Icon';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export const READ_ALOUD_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type ReadAloudRate = (typeof READ_ALOUD_RATES)[number];

const STORAGE_KEY = 'cot-read-aloud-rate-v1';
let cachedRate: ReadAloudRate | null = null;
const listeners = new Set<(rate: ReadAloudRate) => void>();

function normalizeRate(value: unknown): ReadAloudRate {
  const numberValue = Number(value);
  return READ_ALOUD_RATES.includes(numberValue as ReadAloudRate)
    ? numberValue as ReadAloudRate
    : 1;
}

async function readStoredRate() {
  if (cachedRate !== null) return cachedRate;
  try {
    if (Platform.OS === 'web') {
      const storage = (globalThis as any)?.localStorage;
      cachedRate = normalizeRate(storage?.getItem?.(STORAGE_KEY));
    } else {
      cachedRate = normalizeRate(await SecureStore.getItemAsync(STORAGE_KEY));
    }
  } catch {
    cachedRate = 1;
  }
  return cachedRate;
}

async function persistRate(rate: ReadAloudRate) {
  try {
    if (Platform.OS === 'web') {
      (globalThis as any)?.localStorage?.setItem?.(STORAGE_KEY, String(rate));
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, String(rate));
    }
  } catch {
    // Reading speed remains available for the current session even if persistence fails.
  }
}

export function useReadAloudRate() {
  const [rate, setRateState] = useState<ReadAloudRate>(cachedRate ?? 1);

  useEffect(() => {
    let active = true;
    const listener = (next: ReadAloudRate) => { if (active) setRateState(next); };
    listeners.add(listener);
    void readStoredRate().then((stored) => { if (active) setRateState(stored); });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  const setRate = useCallback((next: number) => {
    const safe = normalizeRate(next);
    cachedRate = safe;
    setRateState(safe);
    listeners.forEach((listener) => listener(safe));
    void persistRate(safe);
  }, []);

  return [rate, setRate] as const;
}

export function ReadAloudRateControl({
  value,
  onChange,
  compact = false,
}: {
  value: ReadAloudRate;
  onChange: (rate: ReadAloudRate) => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.labelRow}>
        <Icon name='speedometer-outline' size={15} color={colors.interactive} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Voice speed</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rates}
      >
        {READ_ALOUD_RATES.map((rate) => {
          const selected = value === rate;
          return (
            <Pressable
              key={rate}
              accessibilityRole='button'
              accessibilityLabel={`Read aloud at ${rate} times speed`}
              accessibilityState={{ selected }}
              onPress={() => onChange(rate)}
              style={({ pressed }) => [
                styles.rate,
                compact && styles.rateCompact,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.bgSecondary,
                  borderColor: selected ? colors.interactive : colors.borderSubtle,
                },
                pressed && { opacity: 0.72 },
              ]}
            >
              <Text style={[styles.rateText, { color: selected ? colors.interactive : colors.textSecondary }]}>
                {rate}×
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  wrapCompact: { gap: 5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10.5, fontWeight: '800' },
  rates: { gap: 6, paddingRight: spacing.sm },
  rate: {
    minWidth: 50,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  rateCompact: { minWidth: 44, minHeight: 32, paddingHorizontal: 8 },
  rateText: { fontSize: 10.5, fontWeight: '900' },
});
