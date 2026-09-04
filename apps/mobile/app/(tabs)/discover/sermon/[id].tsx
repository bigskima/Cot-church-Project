import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacySermonDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/sermon/${encodeURIComponent(id)}` as any} />;
}
