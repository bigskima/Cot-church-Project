import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyEventsRoute() {
  return <Redirect href="/general/leadership/events-manage" />;
}
