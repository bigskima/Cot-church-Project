-- Keep online payment infrastructure installed but unavailable until a future
-- production release explicitly certifies provider onboarding and enables it.
-- Manual transfer remains the only active giving method in the current release.

insert into public.platform_feature_flags (
  key,
  name,
  category,
  description,
  global_enabled,
  rollout_percentage,
  configuration
) values (
  'online_payment_giving',
  'Online Payment Giving',
  'finance',
  'Future online giving through configured third-party payment adapters. Kept unavailable until provider onboarding and production verification are complete.',
  false,
  0,
  jsonb_build_object('releaseState', 'future', 'manualGivingRemainsPrimary', true)
)
on conflict (key) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    global_enabled = false,
    rollout_percentage = 0,
    configuration = excluded.configuration,
    updated_at = now();

-- A provider credential/configuration may be prepared in advance, but it must
-- not become operational in this release.
update public.payment_providers
set status = 'disabled', updated_at = now()
where status <> 'disabled';

update public.payment_provider_configs
set is_active = false,
    is_default = false,
    updated_at = now()
where is_active or is_default;

update public.payment_routing_rules
set is_active = false,
    updated_at = now()
where is_active;

update public.giving_settings
set online_payment_enabled = false,
    updated_at = now()
where online_payment_enabled;

create or replace function public.enforce_online_giving_release_lock()
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

  if new.online_payment_enabled and not released then
    raise exception using
      errcode = '42501',
      message = 'Online giving is not available in this production release';
  end if;
  return new;
end;
$$;

drop trigger if exists giving_settings_online_release_lock on public.giving_settings;
create trigger giving_settings_online_release_lock
before insert or update of online_payment_enabled on public.giving_settings
for each row execute function public.enforce_online_giving_release_lock();

comment on function public.enforce_online_giving_release_lock() is
  'Prevents online payment giving from being enabled while the Level-1 online_payment_giving release flag remains disabled. Provider adapter code and Vault credentials may exist without making checkout available.';
