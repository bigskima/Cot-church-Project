import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CallExperience } from '@/features/calls/CallExperience';

export default function ChatCallRoute() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  return <CallExperience callId={String(callId ?? '')} />;
}
