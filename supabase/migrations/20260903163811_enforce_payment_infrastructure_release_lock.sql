-- Defense-in-depth for the current manual-giving release. Platform Admin may
-- prepare encrypted provider credentials and inactive provider configurations,
-- but no online payment provider/configuration/route may become operational yet.

create or replace function public.enforce_payment_infrastructure_release_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  released boolean := false;
begin
  select coalesce(global_enabled, false)
  into released
  from public.platform_feature_flags
  where key = 'online_payment_giving';

  if released then
    return new;
  end if;

  if tg_table_name = 'payment_providers' and new.status = 'active' then
    raise exception using errcode = '42501', message = 'Online payment providers are not available in this release';
  end if;

  if tg_table_name = 'payment_provider_configs' and (new.is_active or new.is_default) then
    raise exception using errcode = '42501', message = 'Payment provider configurations may be saved only as inactive preparation in this release';
  end if;

  if tg_table_name = 'payment_routing_rules' and new.is_active then
    raise exception using errcode = '42501', message = 'Online payment routing is not available in this release';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_provider_release_lock on public.payment_providers;
create trigger payment_provider_release_lock
before insert or update of status on public.payment_providers
for each row execute function public.enforce_payment_infrastructure_release_lock();

drop trigger if exists payment_provider_config_release_lock on public.payment_provider_configs;
create trigger payment_provider_config_release_lock
before insert or update of is_active, is_default on public.payment_provider_configs
for each row execute function public.enforce_payment_infrastructure_release_lock();

drop trigger if exists payment_route_release_lock on public.payment_routing_rules;
create trigger payment_route_release_lock
before insert or update of is_active on public.payment_routing_rules
for each row execute function public.enforce_payment_infrastructure_release_lock();

comment on function public.enforce_payment_infrastructure_release_lock() is
  'Keeps future online payment infrastructure non-operational while online_payment_giving is disabled. Credentials/config metadata may still be prepared safely.';
