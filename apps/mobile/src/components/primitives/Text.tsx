import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/state/theme';
import { typography } from '@/design-system/tokens';

type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'button'
  | 'buttonSmall';

type TextColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'link'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'live';

interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  color?: TextColor;
  weight?: '400' | '500' | '600' | '700' | '800';
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  style?: RNTextProps['style'];
}

function variantStyle(variant: TextVariant) {
  if (variant === 'button') return { ...typography.bodyStrong, fontWeight: '700' as const };
  if (variant === 'buttonSmall') return { ...typography.caption, fontWeight: '700' as const };
  return typography[variant];
}

export const Text = React.forwardRef<RNText, TextProps>(
  ({ variant = 'body', color = 'primary', weight, align = 'auto', style, ...props }, ref) => {
    const { colors } = useTheme();
    const token = variantStyle(variant);
    const textColor = {
      primary: colors.text,
      secondary: colors.textSecondary,
      muted: colors.textMuted,
      inverse: colors.textInverse,
      link: colors.interactive,
      destructive: colors.live,
      success: colors.success,
      warning: colors.warning,
      live: colors.live,
    }[color];

    return (
      <RNText
        ref={ref}
        style={[
          token,
          {
            color: textColor,
            textAlign: align,
            ...(weight ? { fontWeight: weight } : null),
          },
          style,
        ]}
        {...props}
      />
    );
  },
);

Text.displayName = 'Text';
