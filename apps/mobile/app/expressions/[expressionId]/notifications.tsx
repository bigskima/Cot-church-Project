import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { NotificationsExperience } from '@/features/notifications/NotificationsExperience';

export default function ExpressionNotificationsScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  return <NotificationsExperience forcedExpressionId={String(expressionId || '')} />;
}
