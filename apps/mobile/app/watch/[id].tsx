import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyWatchDetailRoute() {
  const { id, context } = useLocalSearchParams<{ id?: string; context?: string }>();
  if (context === 'expression') return <Redirect href="/expressions" />;
  return <Redirect href={`/general/watch/${typeof id === 'string' ? id : ''}` as any} />;
}
