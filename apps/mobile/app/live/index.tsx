import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyLiveRoute() {
  return <Redirect href="/general/live" />;
}
