-- Level-1 platform audit records are append-only. Runtime service-role clients may
-- append records, but no normal application path may rewrite or delete history.

create or replace function public.prevent_platform_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'Platform audit records are append-only';
end;
$$;

drop trigger if exists platform_audit_append_only on public.platform_audit_log;
create trigger platform_audit_append_only
before update or delete on public.platform_audit_log
for each row execute function public.prevent_platform_audit_mutation();

comment on table public.platform_audit_log is
  'Append-only Level-1 governance and security audit trail. Update and delete are blocked by trigger.';
