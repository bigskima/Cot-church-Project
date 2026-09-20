import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  url: string;
  alt?: string;
  widthHint?: number | null;
  heightHint?: number | null;
  aspectRatioHint?: number | null;
  resizeMode?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

function validRatio(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Media image that preserves the source file's geometry.
 *
 * Prefer stored dimensions from the upload. If older media does not have them,
 * probe the image itself instead of forcing every upload into a fixed rectangle.
 */
export function AdaptiveMediaImage({
  url,
  alt = 'Image',
  widthHint,
  heightHint,
  aspectRatioHint,
  resizeMode = 'contain',
  style,
  backgroundColor = 'transparent',
}: Props) {
  const hintedRatio = useMemo(() => {
    const explicit = validRatio(aspectRatioHint);
    if (explicit) return explicit;
    if (
      typeof widthHint === 'number' &&
      typeof heightHint === 'number' &&
      widthHint > 0 &&
      heightHint > 0
    ) return widthHint / heightHint;
    return null;
  }, [aspectRatioHint, heightHint, widthHint]);

  const [measuredRatio, setMeasuredRatio] = useState<number | null>(hintedRatio);

  useEffect(() => {
    setMeasuredRatio(hintedRatio);
    if (hintedRatio || !url) return;

    let active = true;
    Image.getSize(
      url,
      (width, height) => {
        if (active && width > 0 && height > 0) setMeasuredRatio(width / height);
      },
      () => {
        if (active) setMeasuredRatio(null);
      },
    );
    return () => { active = false; };
  }, [hintedRatio, url]);

  const ratio = measuredRatio ?? 4 / 3;

  return (
    <View style={[styles.frame, { aspectRatio: ratio, backgroundColor }, style]}>
      <Image
        source={{ uri: url }}
        style={styles.image}
        resizeMode={resizeMode}
        accessibilityLabel={alt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
