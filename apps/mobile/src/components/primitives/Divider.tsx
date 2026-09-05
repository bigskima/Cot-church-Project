import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';

export interface DividerProps {
  style?: StyleProp<ViewStyle>;
  vertical?: boolean;
}

export function Divider({ style, vertical = false }: DividerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        vertical
          ? { width: 1, height: '100%', backgroundColor: colors.borderSubtle }
          : { height: 1, width: '100%', backgroundColor: colors.borderSubtle },
        style,
      ]}
    />
  );
}
