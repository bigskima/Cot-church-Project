import React from 'react';
import { View } from 'react-native';
import { ExpressionManagementHub } from '@/features/expression-management/ExpressionManagementHub';

export default function ExpressionManagementScreen() {
  return (
    <View
      style={{ flex: 1 }}
      accessibilityLabel="This page updates the Expression name, member code and timezone, plus its public location and imagery."
    >
      <ExpressionManagementHub />
    </View>
  );
}
