import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import GeneralComposerExperience from '@/features/general/GeneralComposerExperience';

export default function GeneralCommunityScreen() {
  const { compose } = useLocalSearchParams<{ compose?: string }>();

  if (!compose) return <Redirect href="/general" />;

  return <GeneralComposerExperience mode={compose === 'audio' ? 'audio' : 'post'} />;
}
