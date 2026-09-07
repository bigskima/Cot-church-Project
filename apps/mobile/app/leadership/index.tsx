import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyIndexRoute() {
  return <Redirect href="/general/leadership" />;
}
