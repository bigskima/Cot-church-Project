import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacySermonDetailRoute() {
  const { id, context } = useLocalSearchParams<{ id?: string; context?: string }>();
  if (context === 'expression') return <Redirect href="/expressions" />;
  return <Redirect href={`/general/sermon/${typeof id === 'string' ? id : ''}` as any} />;
}
