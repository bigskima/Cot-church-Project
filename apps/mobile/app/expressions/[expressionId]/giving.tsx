import React from 'react';
import { GivingScreen } from '@/features/giving/GivingScreen';

export default function ExpressionGivingRoute() {
  return <GivingScreen initialScope='expression' lockedScope />;
}
