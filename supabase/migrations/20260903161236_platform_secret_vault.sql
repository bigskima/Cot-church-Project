-- Platform-managed third-party credentials stored in Supabase Vault.
-- Raw secret values are never exposed through normal tables or returned to the admin UI.

insert into public.permissions(code,name,description,category) values
  ('platform.secrets.manage','Manage platform provider secrets','Create, rotate, and remove encrypted third-party provider credentials used by platform infrastructure.','platform')
on conflict(code) do update set
  name=excluded.name,
  description=excluded.description,
  category='platform',
  is_active=true;

insert into public.platform_role_permissions(role_code,permission_code) values
  ('super_admin','platform.secrets.manage'),
  ('admin','platform.secrets.manage'),
  ('operations','platform.secrets.manage')
on conflict do nothing;

create table if not exists public.platform_secret_metadata(
  secret_reference text primary key check(secret_reference ~ '^[A-Z][A-Z0-9_]{2,127}$'),
  category text not null check(category in('ai','streaming','payments','communications','integration','other')),
  provider_code text,
  description text not null default '',
  vault_secret_id uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

create trigger platform_secret_metadata_updated
before update on public.platform_secret_metadata
for each row execute function public.set_updated_at();

alter table public.platform_secret_metadata enable row level security;

create policy platform_secret_metadata_read
on public.platform_secret_metadata
for select to authenticated
using(public.has_platform_permission('platform.secrets.manage'));

-- Deliberately no direct INSERT/UPDATE/DELETE policy. Secret writes go through the
-- controlled SECURITY DEFINER function below so Vault and audit metadata stay atomic.

create or replace function public.platform_store_secret(
  target_reference text,
  secret_value text,
  secret_category text,
  target_provider_code text default null,
  target_description text default ''
)
returns table(
  secret_reference text,
  category text,
  provider_code text,
  description text,
  rotated_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_reference text;
  existing_id uuid;
  stored_id uuid;
begin
  if auth.uid() is null or not public.has_platform_permission('platform.secrets.manage') then
    raise exception using errcode='42501',message='Platform secret management permission required';
  end if;

  normalized_reference := upper(btrim(target_reference));
  if normalized_reference !~ '^[A-Z][A-Z0-9_]{2,127}$' then
    raise exception using errcode='22023',message='Secret reference must use 3-128 uppercase letters, numbers, or underscores and begin with a letter';
  end if;
  if secret_value is null or length(secret_value) < 1 or length(secret_value) > 65536 then
    raise exception using errcode='22023',message='Secret value is required and must be smaller than 64 KB';
  end if;
  if secret_category not in('ai','streaming','payments','communications','integration','other') then
    raise exception using errcode='22023',message='Invalid secret category';
  end if;
  if target_provider_code is not null and length(btrim(target_provider_code)) > 80 then
    raise exception using errcode='22023',message='Provider code is too long';
  end if;
  if length(coalesce(target_description,'')) > 500 then
    raise exception using errcode='22023',message='Secret description is too long';
  end if;

  select s.id into existing_id
  from vault.secrets s
  where s.name=normalized_reference
  order by s.created_at desc
  limit 1;

  if existing_id is null then
    stored_id := vault.create_secret(
      secret_value,
      normalized_reference,
      coalesce(nullif(btrim(target_description),''),'Platform-managed provider credential'),
      null
    );
  else
    perform vault.update_secret(
      existing_id,
      secret_value,
      normalized_reference,
      coalesce(nullif(btrim(target_description),''),'Platform-managed provider credential'),
      null
    );
    stored_id := existing_id;
  end if;

  insert into public.platform_secret_metadata(
    secret_reference,category,provider_code,description,vault_secret_id,created_by,updated_by,rotated_at
  ) values(
    normalized_reference,
    secret_category,
    nullif(btrim(target_provider_code),''),
    coalesce(target_description,''),
    stored_id,
    auth.uid(),
    auth.uid(),
    now()
  )
  on conflict(secret_reference) do update set
    category=excluded.category,
    provider_code=excluded.provider_code,
    description=excluded.description,
    vault_secret_id=excluded.vault_secret_id,
    updated_by=auth.uid(),
    rotated_at=now();

  insert into public.platform_audit_log(actor_profile_id,action,target_type,target_id,metadata)
  values(
    auth.uid(),
    case when existing_id is null then 'secret.created' else 'secret.rotated' end,
    'platform_secret',
    normalized_reference,
    jsonb_build_object('category',secret_category,'providerCode',nullif(btrim(target_provider_code),''))
  );

  return query
  select m.secret_reference,m.category,m.provider_code,m.description,m.rotated_at
  from public.platform_secret_metadata m
  where m.secret_reference=normalized_reference;
end;
$$;

create or replace function public.platform_delete_secret(target_reference text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_reference text := upper(btrim(target_reference));
  target_id uuid;
begin
  if auth.uid() is null or not public.has_platform_permission('platform.secrets.manage') then
    raise exception using errcode='42501',message='Platform secret management permission required';
  end if;

  select vault_secret_id into target_id
  from public.platform_secret_metadata
  where secret_reference=normalized_reference
  for update;
  if target_id is null then return false; end if;

  delete from vault.secrets where id=target_id;
  delete from public.platform_secret_metadata where secret_reference=normalized_reference;

  insert into public.platform_audit_log(actor_profile_id,action,target_type,target_id,metadata)
  values(auth.uid(),'secret.deleted','platform_secret',normalized_reference,'{}'::jsonb);
  return true;
end;
$$;

-- Runtime-only resolver used by service-role Edge Functions. Authenticated users,
-- including Platform Admins, cannot read a stored value back after submission.
create or replace function public.resolve_runtime_secret(target_reference text)
returns text
language plpgsql
security definer
stable
set search_path=''
as $$
declare
  resolved text;
begin
  select ds.decrypted_secret into resolved
  from vault.decrypted_secrets ds
  where ds.name=upper(btrim(target_reference))
  order by ds.updated_at desc
  limit 1;
  return resolved;
end;
$$;

revoke all on function public.platform_store_secret(text,text,text,text,text) from public;
revoke all on function public.platform_delete_secret(text) from public;
revoke all on function public.resolve_runtime_secret(text) from public;
grant execute on function public.platform_store_secret(text,text,text,text,text) to authenticated;
grant execute on function public.platform_delete_secret(text) to authenticated;
grant execute on function public.resolve_runtime_secret(text) to service_role;
