import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { Button, Icon } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

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
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name="compass-outline" size={30} color={colors.interactive} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>This page isn’t available</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          The link may be outdated, private, or no longer available. Public COT content is still available from Home.
        </Text>
        <Button label="Go to Home" onPress={() => router.replace('/(tabs)/home')} size="lg" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySmall,
    maxWidth: 340,
    textAlign: 'center',
    lineHeight: 20,
  },
});
