-- Keep streaming routing unambiguous across platform and organisation scopes.
-- Older admin saves could create an active configuration without marking it as
-- the default, which made the mobile broadcast readiness endpoint report the
-- streaming service as unavailable even though the provider was enabled.

with ranked_global_defaults as (
  select
    id,
    row_number() over (order by updated_at desc, created_at desc, id) as rn
  from public.streaming_provider_configs
  where organization_id is null
    and is_active = true
    and is_default = true
)
update public.streaming_provider_configs
set is_default = false,
    updated_at = now()
where id in (
  select id
  from ranked_global_defaults
  where rn > 1
);

with ranked_org_defaults as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by updated_at desc, created_at desc, id
    ) as rn
  from public.streaming_provider_configs
  where organization_id is not null
    and is_active = true
    and is_default = true
)
update public.streaming_provider_configs
set is_default = false,
    updated_at = now()
where id in (
  select id
  from ranked_org_defaults
  where rn > 1
);

with global_state as (
  select
    count(*) filter (where is_active = true) as active_count,
    count(*) filter (where is_active = true and is_default = true) as active_default_count
  from public.streaming_provider_configs
  where organization_id is null
),
sole_global as (
  select id
  from public.streaming_provider_configs
  where organization_id is null
    and is_active = true
  order by updated_at desc, created_at desc, id
  limit 1
)
update public.streaming_provider_configs
set is_default = true,
    updated_at = now()
where id = (select id from sole_global)
  and (select active_count from global_state) = 1
  and (select active_default_count from global_state) = 0;

with org_state as (
  select
    organization_id,
    count(*) filter (where is_active = true) as active_count,
    count(*) filter (where is_active = true and is_default = true) as active_default_count
  from public.streaming_provider_configs
  where organization_id is not null
  group by organization_id
),
sole_org as (
  select distinct on (c.organization_id)
    c.organization_id,
    c.id
  from public.streaming_provider_configs c
  join org_state s on s.organization_id = c.organization_id
  where c.is_active = true
    and s.active_count = 1
    and s.active_default_count = 0
  order by c.organization_id, c.updated_at desc, c.created_at desc, c.id
)
update public.streaming_provider_configs c
set is_default = true,
    updated_at = now()
from sole_org s
where c.id = s.id;

create unique index if not exists streaming_provider_configs_one_active_global_default
  on public.streaming_provider_configs ((is_default))
  where organization_id is null
    and is_active = true
    and is_default = true;

create unique index if not exists streaming_provider_configs_one_active_org_default
  on public.streaming_provider_configs (organization_id)
  where organization_id is not null
    and is_active = true
    and is_default = true;
