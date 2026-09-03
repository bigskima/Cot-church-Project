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

export async function defaultStreamingConfig(organizationId: string) {
  const client = adminClient();

  const { data: tenantConfig, error: tenantError } = await client
    .from('streaming_provider_configs')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle();
  if (tenantError) throw new ApiError('STREAMING_CONFIG_LOOKUP_FAILED', 'Unable to resolve streaming provider configuration', 500, undefined, false);
  if (tenantConfig?.id) return loadStreamingConfig(tenantConfig.id);

  const { data: globalConfig, error: globalError } = await client
    .from('streaming_provider_configs')
    .select('id')
    .is('organization_id', null)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle();
  if (globalError) throw new ApiError('STREAMING_CONFIG_LOOKUP_FAILED', 'Unable to resolve streaming provider configuration', 500, undefined, false);
  if (!globalConfig?.id) throw new ApiError('STREAMING_NOT_CONFIGURED', 'No active streaming provider is configured', 503);

  return loadStreamingConfig(globalConfig.id);
}
