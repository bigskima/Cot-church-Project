import { ApiError } from '@/api';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';

export type PlatformRoleAssignment = {
  id?: string;
  role_code?: string;
  expires_at?: string | null;
  created_at?: string;
  platform_roles?: { code?: string; name?: string; description?: string } | null;
};

export type PlatformAdministrationContext = {
  profile?: { id?: string; display_name?: string | null; avatar_url?: string | null };
  email?: string | null;
  roles?: PlatformRoleAssignment[];
  effectivePermissions?: string[];
};

export function isPlatformSuperAdmin(value?: PlatformAdministrationContext | null) {
  return Boolean(value?.roles?.some((role) => role.role_code === 'super_admin'));
}

export function hasPlatformPermission(value: PlatformAdministrationContext | null | undefined, permission: string) {
  return isPlatformSuperAdmin(value) || Boolean(value?.effectivePermissions?.includes(permission));
}

export function usePlatformAdministrationContext() {
  const { api, mode } = useSession();
  return useResource<PlatformAdministrationContext | null>(
    `platform:administration-context:${mode}`,
    async (signal) => {
      if (mode !== 'authenticated') return null;
      try {
        return await api.request<PlatformAdministrationContext>('platform-context', { signal });
      } catch (value) {
        if (value instanceof ApiError && (value.status === 401 || value.status === 403 || value.code === 'PLATFORM_PERMISSION_DENIED')) return null;
        throw value;
      }
    },
  );
}
