import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components';
import { spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import GeneralChurchLeadershipPanel from './GeneralChurchLeadershipPanel';

export default function GeneralChurchLeadershipExperience() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <ScreenHeader
          title="Our Leaders"
          kicker="CHURCH PROFILE"
          subtitle="Manage the leaders shown across General COT."
          showBack
        />
        <View style={styles.body}>
          <GeneralChurchLeadershipPanel />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.lg },
});
