import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyGivingRoute() {
  return <Redirect href="/general/leadership/giving-manage" />;
}
