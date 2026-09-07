import React from 'react';
import { Stack } from 'expo-router';

export default function GeneralLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
