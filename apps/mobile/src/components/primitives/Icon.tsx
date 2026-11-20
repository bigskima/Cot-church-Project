import React from 'react';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

export type IconFamily = 'ionicons' | 'feather';

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  family?: IconFamily;
  style?: StyleProp<TextStyle>;
}

export function Icon({
  name,
  size = 22,
  color = '#0B1628',
  family = 'ionicons',
  style,
}: IconProps) {
  if (family === 'feather') {
    return <Feather name={name as any} size={size} color={color} style={style} />;
  }
  return <Ionicons name={name as any} size={size} color={color} style={style} />;
}
