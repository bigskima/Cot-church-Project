import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionLayeredHomeExperience } from '@/features/expression/ExpressionLayeredHomeExperience';

export default function ExpressionHomeScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  return <ExpressionLayeredHomeExperience expressionId={typeof expressionId === 'string' ? expressionId : ''} />;
}
