import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CallExperience } from '@/features/calls/CallExperience';

export default function ChatCallRoute() {
  const { callId, answer } = useLocalSearchParams<{ callId: string; answer?: string }>();
  return <CallExperience callId={String(callId ?? '')} autoAnswer={answer === '1'} />;
}
