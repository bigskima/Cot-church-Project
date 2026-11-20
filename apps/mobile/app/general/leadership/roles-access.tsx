import React from 'react';
import { Redirect } from 'expo-router';
import GeneralRolesAccessExperience from '@/features/general/GeneralRolesAccessExperience';
import { useGeneralMinistryAccess } from '@/features/general/useGeneralMinistryAccess';

export default function GeneralRolesAccessRoute() {
  const { accessReady, canManageRoles } = useGeneralMinistryAccess();

  if (!accessReady) return null;
  if (!canManageRoles) return <Redirect href="/general/leadership" />;

  return <GeneralRolesAccessExperience />;
}
