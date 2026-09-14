-- Keep testimony response audit rows tenant-scoped.
-- testimony_responses is child data, so its organization/expression scope is always
-- derived from the parent testimony instead of trusting client-supplied scope fields.

alter table public.testimony_responses
  add column if not exists organization_id uuid,
  add column if not exists branch_id uuid;

update public.testimony_responses r
set organization_id = t.organization_id,
    branch_id = t.branch_id
from public.testimonies t
where t.id = r.testimony_id
  and (
    r.organization_id is distinct from t.organization_id
    or r.branch_id is distinct from t.branch_id
  );

create or replace function private.set_testimony_response_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  parent_organization_id uuid;
  parent_branch_id uuid;
begin
  select t.organization_id, t.branch_id
  into parent_organization_id, parent_branch_id
  from public.testimonies t
  where t.id = new.testimony_id;

  if parent_organization_id is null or parent_branch_id is null then
    raise exception using errcode = '23503', message = 'Parent testimony was not found';
  end if;

  new.organization_id := parent_organization_id;
  new.branch_id := parent_branch_id;
  return new;
end;
$function$;

revoke all on function private.set_testimony_response_scope() from public, anon, authenticated;

drop trigger if exists testimony_responses_scope_from_parent on public.testimony_responses;
create trigger testimony_responses_scope_from_parent
before insert or update of testimony_id, organization_id, branch_id
on public.testimony_responses
for each row execute function private.set_testimony_response_scope();

alter table public.testimony_responses
  alter column organization_id set not null,
  alter column branch_id set not null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.testimony_responses'::regclass
      and conname = 'testimony_responses_organization_id_fkey'
  ) then
    alter table public.testimony_responses
      add constraint testimony_responses_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.testimony_responses'::regclass
      and conname = 'testimony_responses_branch_scope_fkey'
  ) then
    alter table public.testimony_responses
      add constraint testimony_responses_branch_scope_fkey
      foreign key (branch_id, organization_id)
      references public.branches(id, organization_id) on delete cascade;
  end if;
end
$constraints$;

create index if not exists testimony_responses_scope_time_idx
  on public.testimony_responses(organization_id, branch_id, created_at desc);

-- Recreate the shared audit trigger after the scope trigger so inserts/updates are
-- recorded with organization_id and branch_id populated in the audited row.
drop trigger if exists audit_testimony_responses on public.testimony_responses;
create trigger audit_testimony_responses
after insert or update or delete on public.testimony_responses
for each row execute function public.audit_row_change();
