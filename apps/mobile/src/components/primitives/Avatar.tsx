import React from 'react';
import { Image, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { brand, radius } from '@/design-system/tokens';

export interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
  showBorder?: boolean;
}

const SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 52,
  xl: 72,
};

const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 15,
  lg: 20,
  xl: 26,
};

export function Avatar({
  url,
  name,
  size = 'md',
  style,
  showBorder = false,
}: AvatarProps) {
  const { colors } = useTheme();
  const dim = SIZES[size];
  const fontSize = FONT_SIZES[size];

  const getInitials = (n?: string | null) => {
    if (!n || !n.trim()) return 'M';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const containerStyle: ViewStyle = {
    width: dim,
    height: dim,
    borderRadius: dim / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: showBorder ? 2 : 0,
    borderColor: colors.borderStrong,
  };

  if (url) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{ uri: url }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <Text
        style={{
          fontSize,
          fontWeight: '700',
          color: colors.interactive,
          letterSpacing: 0.2,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}
