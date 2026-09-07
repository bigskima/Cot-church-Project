import React from 'react';
import { Slot, useLocalSearchParams } from 'expo-router';
import { ExpressionRouteBoundary } from '@/components/expression/ExpressionRouteBoundary';
import { ExpressionShell } from '@/components/expression/ExpressionShell';

export default function ExpressionWorkspaceLayout() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';

  if (!id) return null;

  return (
    <ExpressionRouteBoundary expressionId={id}>
      <ExpressionShell expressionId={id}>
        <Slot />
      </ExpressionShell>
    </ExpressionRouteBoundary>
  );
}
