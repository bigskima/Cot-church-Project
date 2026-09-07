import { ApiError } from '../errors.ts';
import { adminClient } from '../supabase.ts';
import type { ProviderConfiguration } from './types.ts';

export type LoadedStreamingConfig = {
  id: string;
  organizationId: string | null;
  providerId: string;
  provider: ProviderConfiguration;
};

export async function loadStreamingConfig(configId: string) {
  const { data, error } = await adminClient()
    .from('streaming_provider_configs')
    .select('id,organization_id,secret_reference,webhook_secret_reference,signing_key_reference,configuration,streaming_providers!inner(id,code,is_active)')
    .eq('id', configId)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) throw new ApiError('STREAMING_NOT_CONFIGURED', 'Streaming provider configuration is unavailable', 503, undefined, false);

  const relation = (Array.isArray(data.streaming_providers) ? data.streaming_providers[0] : data.streaming_providers) as unknown as { id: string; code: string; is_active: boolean };
  if (!relation?.is_active) throw new ApiError('STREAMING_PROVIDER_DISABLED', 'Streaming provider is disabled', 503);

  return {
    id: data.id,
    organizationId: data.organization_id,
    providerId: relation.id,
    provider: {
      providerCode: relation.code,
      secretReference: data.secret_reference,
      webhookSecretReference: data.webhook_secret_reference,
      signingKeyReference: data.signing_key_reference,
      settings: data.configuration as Record<string, unknown>,
    },
  } as LoadedStreamingConfig;
}

async function scopedStreamingConfigId(organizationId: string | null) {
  const client = adminClient();
  let query = client
    .from('streaming_provider_configs')
    .select('id,is_default')
    .eq('is_active', true);

  query = organizationId === null
    ? query.is('organization_id', null)
    : query.eq('organization_id', organizationId);

  const { data, error } = await query
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(2);

  if (error) {
    throw new ApiError('STREAMING_CONFIG_LOOKUP_FAILED', 'Unable to resolve streaming provider configuration', 500, undefined, false);
  }

  const rows = data ?? [];
  const explicitDefaults = rows.filter((row) => row.is_default);

  if (explicitDefaults.length === 1) return explicitDefaults[0].id;
  if (explicitDefaults.length > 1) {
    throw new ApiError('STREAMING_NOT_CONFIGURED', 'Multiple default streaming providers are configured for the same scope', 503, undefined, false);
  }

  // A single active configuration is unambiguous and should remain usable even
  // when an older admin save omitted the default flag.
  if (rows.length === 1) return rows[0].id;
  if (rows.length > 1) {
    throw new ApiError('STREAMING_NOT_CONFIGURED', 'Choose a default streaming provider before creating broadcasts', 503, undefined, false);
  }

  return null;
}

export async function defaultStreamingConfig(organizationId: string) {
  const tenantConfigId = await scopedStreamingConfigId(organizationId);
  if (tenantConfigId) return loadStreamingConfig(tenantConfigId);

  const globalConfigId = await scopedStreamingConfigId(null);
  if (!globalConfigId) throw new ApiError('STREAMING_NOT_CONFIGURED', 'No active streaming provider is configured', 503);

  return loadStreamingConfig(globalConfigId);
}
