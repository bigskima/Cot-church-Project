import React from 'react';
import { View } from 'react-native';
import { ScreenHeader } from '@/components';
import { spacing } from '@/design-system/tokens';
import { FeedRankingSettingsExperience } from '@/features/feed/FeedRankingSettingsExperience';
import { useTheme } from '@/state/theme';

export default function GeneralFeedRankingScreen() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: spacing.md }}>
        <ScreenHeader
          title="Feed Ranking"
          kicker="GENERAL COT"
          subtitle="Tune the explainable Home ranking defaults used by General COT and inherited by Expressions without overrides."
          showBack
        />
      </View>
      <FeedRankingSettingsExperience scope="general" />
    </View>
  );
}
