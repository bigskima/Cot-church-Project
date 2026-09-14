import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CommunityParticipationExperience } from '@/features/community/CommunityParticipationExperience';
import { GiveawayComposerExperience } from '@/features/community/GiveawayComposerExperience';
import { PollComposerExperience } from '@/features/community/PollComposerExperience';

export default function GeneralParticipationScreen() {
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  if (compose === 'poll') return <PollComposerExperience scope="general" />;
  if (compose === 'giveaway') return <GiveawayComposerExperience scope="general" />;
  return <CommunityParticipationExperience scope="general" />;
}
