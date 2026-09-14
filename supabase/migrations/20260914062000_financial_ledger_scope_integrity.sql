-- Enforce Expression/organization scope integrity inside the immutable finance ledger.
-- The UI already supplies matching records, but the database must remain the final
-- authority if a client bypasses the screen and writes directly through the Data API.

create or replace function private.validate_financial_ledger_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  finance_account public.financial_accounts%rowtype;
  finance_session public.financial_sessions%rowtype;
  giving_purpose public.giving_purposes%rowtype;
  giving_campaign public.giving_campaigns%rowtype;
begin
  select * into finance_account
  from public.financial_accounts a
  where a.id = new.account_id;

  if finance_account.id is null then
    raise exception using errcode = '23503', message = 'Finance account was not found';
  end if;

  if finance_account.organization_id <> new.organization_id
     or finance_account.branch_id is distinct from new.branch_id then
    raise exception using errcode = '23514', message = 'Finance account does not belong to this ledger scope';
  end if;

  if finance_account.status <> 'active' then
    raise exception using errcode = '23514', message = 'Finance account is not active';
  end if;

  if upper(finance_account.currency::text) <> upper(new.currency::text) then
    raise exception using errcode = '23514', message = 'Ledger currency must match the finance account currency';
  end if;

  if new.session_id is not null then
    select * into finance_session
    from public.financial_sessions s
    where s.id = new.session_id;

    if finance_session.id is null then
      raise exception using errcode = '23503', message = 'Financial session was not found';
    end if;

    if finance_session.organization_id <> new.organization_id
       or finance_session.branch_id is distinct from new.branch_id then
      raise exception using errcode = '23514', message = 'Financial session does not belong to this ledger scope';
    end if;

    if finance_session.status not in ('open', 'reconciling') then
      raise exception using errcode = '23514', message = 'Entries cannot be added to a reconciled or locked financial session';
    end if;
  end if;

  if new.giving_purpose_id is not null then
    select * into giving_purpose
    from public.giving_purposes p
    where p.id = new.giving_purpose_id;

    if giving_purpose.id is null then
      raise exception using errcode = '23503', message = 'Giving purpose was not found';
    end if;

    if giving_purpose.organization_id <> new.organization_id
       or giving_purpose.branch_id is distinct from new.branch_id then
      raise exception using errcode = '23514', message = 'Giving purpose does not belong to this ledger scope';
    end if;
  end if;

  if new.giving_campaign_id is not null then
    select * into giving_campaign
    from public.giving_campaigns c
    where c.id = new.giving_campaign_id;

    if giving_campaign.id is null then
      raise exception using errcode = '23503', message = 'Giving campaign was not found';
    end if;

    if giving_campaign.organization_id <> new.organization_id
       or giving_campaign.branch_id is distinct from new.branch_id then
      raise exception using errcode = '23514', message = 'Giving campaign does not belong to this ledger scope';
    end if;

    if upper(giving_campaign.currency::text) <> upper(new.currency::text) then
      raise exception using errcode = '23514', message = 'Giving campaign currency must match the ledger currency';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_financial_ledger_scope() from public, anon, authenticated;

drop trigger if exists financial_ledger_scope_integrity on public.financial_ledger_entries;
create trigger financial_ledger_scope_integrity
before insert or update of organization_id, branch_id, account_id, session_id, giving_purpose_id, giving_campaign_id, currency
on public.financial_ledger_entries
for each row execute function private.validate_financial_ledger_scope();

comment on function private.validate_financial_ledger_scope() is
  'Prevents cross-organization / cross-Expression references and currency mismatches in the immutable documentation ledger.';
