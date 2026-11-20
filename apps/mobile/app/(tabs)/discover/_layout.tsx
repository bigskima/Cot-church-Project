import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/state/theme';

export default function DiscoverStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
