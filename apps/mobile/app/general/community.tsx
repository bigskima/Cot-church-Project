import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import GeneralComposerExperience from '@/features/general/GeneralComposerExperience';

export default function GeneralCommunityScreen() {
  const params = useLocalSearchParams<{
    compose?: string;
    scriptureReference?: string;
    scriptureText?: string;
    scriptureVersion?: string;
  }>();
  const compose = typeof params.compose === 'string' ? params.compose : undefined;

  if (!compose) return <Redirect href="/general" />;

  const scriptureShare = typeof params.scriptureReference === 'string' && typeof params.scriptureText === 'string'
    ? {
        reference: params.scriptureReference,
        text: params.scriptureText,
        version: typeof params.scriptureVersion === 'string' ? params.scriptureVersion : 'Bible',
      }
    : undefined;

  return <GeneralComposerExperience mode={compose === 'audio' ? 'audio' : 'post'} initialScripture={scriptureShare} />;
}
