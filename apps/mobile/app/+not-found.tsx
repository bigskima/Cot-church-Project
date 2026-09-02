import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { Icon } from '@/components/primitives/Icon';
import { spacing } from '@/design-system/tokens';

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + spacing.xxl,
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
    >
      <Icon name="compass-outline" size={40} color={colors.interactive} />
      <Text style={[styles.title, { color: colors.text }]}>This page isn’t available</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>The link may be outdated, private, or no longer available.</Text>
      <Pressable
        onPress={() => router.replace('/(tabs)/home')}
        style={[styles.button, { backgroundColor: colors.interactive }]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Go home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    maxWidth: 360,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    minHeight: 46,
    minWidth: 150,
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
