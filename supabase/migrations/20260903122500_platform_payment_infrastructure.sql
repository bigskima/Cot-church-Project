-- Level-1 payment infrastructure control plane.
-- Provider secrets remain outside Postgres; only secret reference names are stored.

create table public.payment_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (char_length(trim(name)) between 1 and 120),
  adapter_version text not null,
  status text not null default 'disabled' check (status in ('active', 'disabled', 'degraded')),
  capabilities text[] not null default '{}',
  supported_currencies text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_provider_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_id uuid not null references public.payment_providers(id) on delete restrict,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  secret_reference text not null check (secret_reference ~ '^[A-Z][A-Z0-9_]{2,127}$'),
  webhook_secret_reference text not null check (webhook_secret_reference ~ '^[A-Z][A-Z0-9_]{2,127}$'),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  is_default boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, provider_id, environment)
);

create table public.payment_routing_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  currency char(3) not null check (currency = upper(currency)),
  payment_method text not null check (payment_method ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_id uuid not null references public.payment_providers(id) on delete restrict,
  priority integer not null default 100 check (priority between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, currency, payment_method, provider_id)
);

create index payment_provider_configs_scope_idx
  on public.payment_provider_configs (organization_id, environment, is_active, is_default);
create index payment_routing_rules_lookup_idx
  on public.payment_routing_rules (organization_id, currency, payment_method, is_active, priority);

create trigger payment_providers_updated
  before update on public.payment_providers
  for each row execute function public.set_updated_at();
create trigger payment_provider_configs_updated
  before update on public.payment_provider_configs
  for each row execute function public.set_updated_at();
create trigger payment_routing_rules_updated
  before update on public.payment_routing_rules
  for each row execute function public.set_updated_at();

alter table public.payment_providers enable row level security;
alter table public.payment_provider_configs enable row level security;
alter table public.payment_routing_rules enable row level security;

-- These tables are Level-1 infrastructure. Tenant users must never read secret
-- reference names or mutate routing directly through PostgREST.
revoke all on public.payment_providers, public.payment_provider_configs, public.payment_routing_rules from anon, authenticated;

-- Built-in adapter metadata is registry data, not runtime activation. Providers
-- remain disabled until a Platform Admin deliberately configures and activates them.
insert into public.payment_providers (
  code,
  name,
  adapter_version,
  status,
  capabilities,
  supported_currencies
) values
  (
    'stripe',
    'Stripe',
    '2026-09-03',
    'disabled',
    array['cards','apple_pay','google_pay','refunds','reconciliation','webhooks'],
    array['USD','GBP','EUR','CAD','AUD']
  ),
  (
    'paystack',
    'Paystack',
    '2026-09-03',
    'disabled',
    array['cards','bank_transfer','ussd','mobile_money','refunds','webhooks'],
    array['NGN','GHS','ZAR','KES']
  )
on conflict (code) do update
set name = excluded.name,
    adapter_version = excluded.adapter_version,
    capabilities = excluded.capabilities,
    supported_currencies = excluded.supported_currencies,
    updated_at = now();

-- Preserve provider identifiers already present in real payment attempts without
-- pretending an adapter/configuration is operational.
insert into public.payment_providers (code, name, adapter_version, status)
select distinct
  lower(trim(provider)) as code,
  initcap(replace(lower(trim(provider)), '_', ' ')) as name,
  'legacy' as adapter_version,
  'disabled' as status
from public.payment_attempts
where provider is not null
  and lower(trim(provider)) ~ '^[a-z][a-z0-9_]{1,39}$'
on conflict (code) do nothing;

comment on table public.payment_providers is
  'Level-1 registry of installed payment provider adapters. Status does not imply credentials are configured.';
comment on table public.payment_provider_configs is
  'Level-1 payment configuration references. Stores only server-side secret reference names, never raw credentials.';
comment on table public.payment_routing_rules is
  'Database-driven provider routing by optional organization scope, currency, payment method and priority.';
