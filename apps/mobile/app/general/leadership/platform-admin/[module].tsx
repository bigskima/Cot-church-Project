import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyPlatformAdministrationModuleRoute() {
  return <Redirect href="/general/leadership/platform-admin" />;
}
