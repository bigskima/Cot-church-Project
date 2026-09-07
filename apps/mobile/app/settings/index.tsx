import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacySettingsRoute() {
  return <Redirect href="/general/settings" />;
}
