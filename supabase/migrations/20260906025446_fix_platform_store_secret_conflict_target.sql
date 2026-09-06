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
  on conflict on constraint platform_secret_metadata_pkey do update set
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

revoke all on function public.platform_store_secret(text,text,text,text,text) from public, anon;
grant execute on function public.platform_store_secret(text,text,text,text,text) to authenticated, service_role;
