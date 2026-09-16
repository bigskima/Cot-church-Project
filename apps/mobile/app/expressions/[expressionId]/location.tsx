import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PublicLocationExperience } from '@/features/location/PublicLocationExperience';

export default function ExpressionLocationScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  return <PublicLocationExperience scope="expression" expressionId={typeof expressionId === 'string' ? expressionId : undefined} />;
}
