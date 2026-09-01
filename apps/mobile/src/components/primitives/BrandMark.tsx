import React from 'react';
import { Image, StyleSheet, View, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { useBranding } from '@/state/branding';
import { useTheme } from '@/state/theme';

const defaultCotLogo = require('../../../assets/cot-family-logo.png');

export interface BrandMarkProps {
  variant?: 'auth' | 'header' | 'compact' | 'icon';
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function BrandMark({
  variant = 'compact',
  size,
  style,
  imageStyle,
}: BrandMarkProps) {
  const { isDark } = useTheme();
  const { primaryLogoUrl, compactLogoUrl, darkLogoUrl } = useBranding();

  const remoteUrl = isDark
    ? darkLogoUrl || primaryLogoUrl
    : primaryLogoUrl || compactLogoUrl;

  const defaultDimensions = {
    auth: { width: size || 72, height: size || 72 },
    header: { width: size || 36, height: size || 36 },
    compact: { width: size || 28, height: size || 28 },
    icon: { width: size || 24, height: size || 24 },
  }[variant];

  return (
    <View style={[styles.container, defaultDimensions, style]}>
      <Image
        source={remoteUrl ? { uri: remoteUrl } : defaultCotLogo}
        style={[styles.image, defaultDimensions, imageStyle]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Church Logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
