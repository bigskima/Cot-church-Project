import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacySermonsRoute() {
  return <Redirect href="/general/leadership/sermons-manage" />;
}
