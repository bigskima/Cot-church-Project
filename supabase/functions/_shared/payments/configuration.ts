import { ApiError } from '../errors.ts';
import { adminClient } from '../supabase.ts';
import { resolveSecretValue } from '../secrets.ts';
import { paymentProvider } from './registry.ts';
import type { PaymentProviderConfiguration } from './types.ts';

async function routeRow(organizationId:string,currency:string,paymentMethod:string){
  const admin=adminClient();
  const columns='id,organization_id,currency,payment_method,provider_id,priority,payment_providers!inner(id,code,name,status,supported_currencies,adapter_version)';
  const{data:tenant,error:tenantError}=await admin.from('payment_routing_rules').select(columns).eq('organization_id',organizationId).eq('currency',currency).eq('payment_method',paymentMethod).eq('is_active',true).order('priority',{ascending:true}).limit(1).maybeSingle();
  if(tenantError)throw new ApiError('PAYMENT_ROUTE_LOOKUP_FAILED','Unable to resolve payment route',500,undefined,false);
  if(tenant)return tenant as any;
  const{data:global,error:globalError}=await admin.from('payment_routing_rules').select(columns).is('organization_id',null).eq('currency',currency).eq('payment_method',paymentMethod).eq('is_active',true).order('priority',{ascending:true}).limit(1).maybeSingle();
  if(globalError)throw new ApiError('PAYMENT_ROUTE_LOOKUP_FAILED','Unable to resolve payment route',500,undefined,false);
  return global as any;
}

async function configRow(organizationId:string,providerId:string,environment:'production'|'sandbox'){
  const admin=adminClient();
  const columns='id,organization_id,provider_id,environment,secret_reference,webhook_secret_reference,configuration,is_default,is_active';
  const{data:tenant,error:tenantError}=await admin.from('payment_provider_configs').select(columns).eq('organization_id',organizationId).eq('provider_id',providerId).eq('environment',environment).eq('is_active',true).maybeSingle();
  if(tenantError)throw new ApiError('PAYMENT_CONFIG_LOOKUP_FAILED','Unable to resolve payment provider configuration',500,undefined,false);
  if(tenant)return tenant as any;
  const{data:global,error:globalError}=await admin.from('payment_provider_configs').select(columns).is('organization_id',null).eq('provider_id',providerId).eq('environment',environment).eq('is_active',true).maybeSingle();
  if(globalError)throw new ApiError('PAYMENT_CONFIG_LOOKUP_FAILED','Unable to resolve payment provider configuration',500,undefined,false);
  return global as any;
}

export async function resolvePaymentRoute(organizationId:string,currency:string,paymentMethod:string,environment:'production'|'sandbox'='production'){
  const normalizedCurrency=currency.toUpperCase(),normalizedMethod=paymentMethod.toLowerCase();
  const route=await routeRow(organizationId,normalizedCurrency,normalizedMethod);
  if(!route)throw new ApiError('PAYMENT_ROUTE_UNAVAILABLE',`Online giving is not configured for ${normalizedCurrency} ${normalizedMethod.replace(/_/g,' ')}`,503,undefined,false);
  const provider=Array.isArray(route.payment_providers)?route.payment_providers[0]:route.payment_providers;
  if(!provider||provider.status!=='active')throw new ApiError('PAYMENT_PROVIDER_INACTIVE','The configured payment provider is unavailable',503,undefined,false);
  paymentProvider(provider.code);
  if(Array.isArray(provider.supported_currencies)&&provider.supported_currencies.length&&!provider.supported_currencies.includes(normalizedCurrency))throw new ApiError('PAYMENT_CURRENCY_UNSUPPORTED',`${provider.name} does not support ${normalizedCurrency}`,409);
  const config=await configRow(organizationId,provider.id,environment);
  if(!config)throw new ApiError('PAYMENT_PROVIDER_NOT_CONFIGURED',`${provider.name} has no active ${environment} configuration`,503,undefined,false);
  await Promise.all([resolveSecretValue(config.secret_reference),resolveSecretValue(config.webhook_secret_reference)]);
  const resolved:PaymentProviderConfiguration={configId:config.id,organizationId:config.organization_id,providerId:provider.id,providerCode:provider.code,providerName:provider.name,environment,secretReference:config.secret_reference,webhookSecretReference:config.webhook_secret_reference,settings:(config.configuration??{}) as Record<string,unknown>};
  return{route,resolved,adapter:paymentProvider(provider.code)};
}

export async function loadPaymentConfiguration(configId:string){
  const admin=adminClient();
  const{data,error}=await admin.from('payment_provider_configs').select('id,organization_id,provider_id,environment,secret_reference,webhook_secret_reference,configuration,is_active,payment_providers!inner(id,code,name,status,adapter_version)').eq('id',configId).eq('is_active',true).maybeSingle();
  if(error||!data)throw new ApiError('PAYMENT_PROVIDER_NOT_CONFIGURED','Payment provider configuration is unavailable',503,undefined,false);
  const provider=Array.isArray(data.payment_providers)?data.payment_providers[0]:data.payment_providers as any;
  if(!provider||provider.status!=='active')throw new ApiError('PAYMENT_PROVIDER_INACTIVE','Payment provider is unavailable',503,undefined,false);
  const resolved:PaymentProviderConfiguration={configId:data.id,organizationId:data.organization_id,providerId:provider.id,providerCode:provider.code,providerName:provider.name,environment:data.environment as 'production'|'sandbox',secretReference:data.secret_reference,webhookSecretReference:data.webhook_secret_reference,settings:(data.configuration??{}) as Record<string,unknown>};
  return{resolved,adapter:paymentProvider(provider.code)};
}

export async function hasOperationalPaymentRoute(organizationId:string){
  const admin=adminClient();
  const{data,error}=await admin.from('payment_routing_rules').select('currency,payment_method').eq('is_active',true).or(`organization_id.eq.${organizationId},organization_id.is.null`).limit(30);
  if(error)throw new ApiError('PAYMENT_ROUTE_LOOKUP_FAILED','Unable to inspect payment routing',500,undefined,false);
  for(const route of data??[]){try{await resolvePaymentRoute(organizationId,route.currency,route.payment_method);return true;}catch{/* inspect next route */}}
  return false;
}
