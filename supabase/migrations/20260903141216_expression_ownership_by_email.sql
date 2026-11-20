-- Resolve Expression ownership transfers by registered email on the trusted database side.
-- The client never needs to know or submit internal auth/profile UUIDs.

create or replace function public.transfer_expression_ownership_by_email(
  target_branch_id uuid,
  target_email text,
  retain_previous_admin boolean default false
)
returns public.expression_ownerships
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_email text;
  target_profile uuid;
  result public.expression_ownerships;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Authentication required';
  end if;

  normalized_email := lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='22023',message='Invalid email';
  end if;

  select id into target_profile
  from auth.users
  where lower(email)=normalized_email;

  if target_profile is null then
    raise exception using errcode='P0002',message='Registered user not found';
  end if;

  result := public.transfer_expression_ownership(
    target_branch_id,
    target_profile,
    retain_previous_admin
  );

  return result;
end;
$$;

revoke all on function public.transfer_expression_ownership_by_email(uuid,text,boolean) from public;
grant execute on function public.transfer_expression_ownership_by_email(uuid,text,boolean) to authenticated;

comment on function public.transfer_expression_ownership_by_email(uuid,text,boolean) is
  'Transfers audited Expression ownership by registered email without exposing internal profile UUID lookup to clients.';
