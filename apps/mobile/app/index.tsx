import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/state/session';

export default function Index() {
  const { mode } = useSession();

  if (mode === 'restoring') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#091B33',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#2F6FED" />
      </View>
    );
  }

  return <Redirect href={mode === 'authenticated' ? '/(tabs)/home' : '/(auth)/login'} />;
}
