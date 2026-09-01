/**
 * Primitive: Text Component
 * Semantic typography with theme-aware colors
 */

import React from 'react';
import { Text as RNText, StyleSheet, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme/provider';

type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'button' | 'buttonSmall';
type TextColor = keyof typeof colorMap;

const colorMap = {
  primary: (colors: any) => colors.textPrimary,
  secondary: (colors: any) => colors.textSecondary,
  muted: (colors: any) => colors.textMuted,
  inverse: (colors: any) => colors.textInverse,
  link: (colors: any) => colors.link,
  destructive: (colors: any) => colors.destructive,
  success: (colors: any) => colors.success,
  warning: (colors: any) => colors.warning,
  live: (colors: any) => colors.live,
} as const;

interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  color?: TextColor;
  weight?: '400' | '500' | '600' | '700';
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  numberOfLines?: number;
  style?: RNTextProps['style'];
}

export const Text = React.forwardRef<RNText, TextProps>(
  (
    {
      variant = 'body',
      color = 'primary',
      weight,
      align = 'auto',
      style,
      ...props
    },
    ref
  ) => {
    const { colors, typography } = useTheme();
    const typographyStyle = typography[variant];
    const textColor = colorMap[color](colors);

    const computedStyle = [
      {
        fontSize: typographyStyle.fontSize,
        lineHeight: typographyStyle.lineHeight,
        fontWeight: weight || typographyStyle.fontWeight,
        color: textColor,
        textAlign: align,
      },
      style,
    ];

    return <RNText ref={ref} style={computedStyle} {...props} />;
  }
);

Text.displayName = 'Text';
