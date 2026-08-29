/// <reference types="expo/types" />
/// <reference types="expo-router/types" />

declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<boolean>;
  export function hideAsync(): Promise<boolean>;
}
