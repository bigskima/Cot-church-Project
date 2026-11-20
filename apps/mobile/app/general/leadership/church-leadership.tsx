import React from 'react';
import { Redirect } from 'expo-router';

export default function ChurchLeadershipManageRoute() {
  return <Redirect href={{ pathname: '/general/church-story', params: { manage: '1', tab: 'leadership' } } as any} />;
}
