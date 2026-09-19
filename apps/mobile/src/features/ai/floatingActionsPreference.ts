import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'cot-floating-actions-v3';

export type FloatingActionsPreference = {
  x?: number;
  y?: number;
  hidden: boolean;
};

const listeners = new Set<(preference: FloatingActionsPreference) => void>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function loadFloatingActionsPreference(): Promise<FloatingActionsPreference> {
  try {
    const raw = Platform.OS === 'web'
      ? typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      : await SecureStore.getItemAsync(STORAGE_KEY);

    if (!raw) return { hidden: false };
    const value = JSON.parse(raw) as Partial<FloatingActionsPreference>;
    return {
      ...(isFiniteNumber(value.x) ? { x: value.x } : {}),
      ...(isFiniteNumber(value.y) ? { y: value.y } : {}),
      hidden: value.hidden === true,
    };
  } catch {
    return { hidden: false };
  }
}

export async function saveFloatingActionsPreference(preference: FloatingActionsPreference) {
  const normalized: FloatingActionsPreference = {
    ...(isFiniteNumber(preference.x) ? { x: preference.x } : {}),
    ...(isFiniteNumber(preference.y) ? { y: preference.y } : {}),
    hidden: preference.hidden === true,
  };

  try {
    const raw = JSON.stringify(normalized);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, raw);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, raw);
    }
  } catch {
    // The floating menu remains usable even when local persistence is unavailable.
  }

  listeners.forEach((listener) => listener(normalized));
}

export async function setFloatingActionsHidden(hidden: boolean) {
  const current = await loadFloatingActionsPreference();
  await saveFloatingActionsPreference({ ...current, hidden });
}

export function subscribeFloatingActionsPreference(listener: (preference: FloatingActionsPreference) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
