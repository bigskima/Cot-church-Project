-- COT community participation + Expression ministry/finance foundations.
-- All systems are tenant scoped. Testimony and finance are Expression-only by design.

insert into public.permissions (code, name, description, category) values
  ('polls.manage', 'Manage polls', 'Create and manage official polls in General COT or an Expression.', 'content'),
  ('testimonies.review', 'Review testimonies', 'Review and respond to testimony submissions inside an Expression.', 'ministry'),
  ('testimonies.manage', 'Manage testimonies', 'Manage testimony workflow and sharing decisions inside an Expression.', 'ministry'),
  ('finance.read', 'View Expression finance', 'View Expression financial sessions, ledger and balances.', 'finance'),
  ('finance.manage', 'Manage Expression finance', 'Record and reconcile Expression financial activity.', 'finance')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  is_active = true;

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null,
  social_post_id uuid null,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  question text not null check (char_length(btrim(question)) between 1 and 500),
  description text not null default '',
  visibility text not null default 'members' check (visibility in ('public','members')),
  status text not null default 'open' check (status in ('draft','open','closed','cancelled','archived')),
  allows_multiple boolean not null default false,
  closes_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  foreign key (social_post_id, organization_id) references public.social_posts(id, organization_id) on delete set null
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 240),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (poll_id, id)
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (poll_id, option_id) references public.poll_options(poll_id, id) on delete cascade,
  unique (poll_id, option_id, profile_id)
);

create index if not exists polls_scope_status_idx on public.polls(organization_id, branch_id, status, created_at desc);
create index if not exists poll_votes_poll_idx on public.poll_votes(poll_id, option_id);

create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null,
  host_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text not null default '',
  prize_description text not null check (char_length(btrim(prize_description)) between 1 and 2000),
  status text not null default 'draft' check (status in ('draft','open','drawing','completed','cancelled','archived')),
  visibility text not null default 'members' check (visibility in ('public','members')),
  winners_count integer not null default 1 check (winners_count between 1 and 100),
  opens_at timestamptz null,
  closes_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (giveaway_id, profile_id)
);

create table if not exists public.giveaway_winners (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  selected_by uuid not null references public.profiles(id) on delete restrict,
  gift_note text not null default '',
  fulfilled_at timestamptz null,
  selected_at timestamptz not null default now(),
  unique (giveaway_id, profile_id)
);

create index if not exists giveaways_scope_status_idx on public.giveaways(organization_id, branch_id, status, created_at desc);

create table if not exists public.testimonies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  testimony text not null check (char_length(btrim(testimony)) between 1 and 50000),
  occurred_on date null,
  share_in_service_consent boolean not null default false,
  status text not null default 'submitted' check (status in ('draft','submitted','reviewing','responded','approved','declined','archived')),
  invited_to_share boolean not null default false,
  service_notes text not null default '',
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

create table if not exists public.testimony_responses (
  id uuid primary key default gen_random_uuid(),
  testimony_id uuid not null references public.testimonies(id) on delete cascade,
  responder_profile_id uuid not null references public.profiles(id) on delete restrict,
  message text not null check (char_length(btrim(message)) between 1 and 10000),
  response_type text not null default 'message' check (response_type in ('message','share_invitation','review_note','status_update')),
  created_at timestamptz not null default now()
);

create index if not exists testimonies_scope_status_idx on public.testimonies(organization_id, branch_id, status, created_at desc);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null,
  name text not null,
  currency char(3) not null,
  account_type text not null default 'documentation_wallet' check (account_type in ('documentation_wallet','cash','bank','clearing')),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  unique (organization_id, branch_id, currency, account_type, name)
);

create table if not exists public.financial_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  title text not null,
  session_date date not null default current_date,
  status text not null default 'open' check (status in ('open','reconciling','reconciled','locked')),
  notes text not null default '',
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reconciled_by uuid null references public.profiles(id) on delete set null,
  reconciled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  session_id uuid null references public.financial_sessions(id) on delete restrict,
  giving_purpose_id uuid null references public.giving_purposes(id) on delete set null,
  giving_campaign_id uuid null references public.giving_campaigns(id) on delete set null,
  contributor_profile_id uuid null references public.profiles(id) on delete set null,
  contributor_name text null,
  direction text not null check (direction in ('credit','debit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  entry_kind text not null check (entry_kind in ('tithe','offering','special_giving','campaign','expense','transfer','adjustment','other')),
  source_type text not null default 'manual_transfer' check (source_type in ('manual_transfer','cash','online_payment','system','adjustment')),
  source_reference text null,
  memo text not null default '',
  occurred_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

create unique index if not exists financial_ledger_online_source_unique
  on public.financial_ledger_entries(organization_id, source_type, source_reference)
  where source_reference is not null and source_type = 'online_payment';
create index if not exists financial_ledger_scope_time_idx on public.financial_ledger_entries(organization_id, branch_id, occurred_at desc);

create or replace view public.financial_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.organization_id,
  a.branch_id,
  a.name,
  a.currency,
  a.account_type,
  coalesce(sum(case when l.direction = 'credit' then l.amount_minor else -l.amount_minor end), 0)::bigint as balance_minor
from public.financial_accounts a
left join public.financial_ledger_entries l on l.account_id = a.id
group by a.id, a.organization_id, a.branch_id, a.name, a.currency, a.account_type;

-- Audit all ministry/finance workflow changes using the platform's existing audit function.
do $triggers$
declare
  tbl text;
begin
  foreach tbl in array array['polls','giveaways','testimonies','testimony_responses','financial_accounts','financial_sessions','financial_ledger_entries']
  loop
    execute format('drop trigger if exists audit_%I on public.%I', tbl, tbl);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', tbl, tbl);
  end loop;
end
$triggers$;

-- Keep ordinary mutable records timestamped. Ledger rows intentionally have no update trigger;
-- corrections should be represented by new adjustment entries, preserving an audit trail.
do $updated$
declare
  tbl text;
begin
  foreach tbl in array array['polls','giveaways','testimonies','financial_accounts','financial_sessions']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', tbl, tbl);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end
$updated$;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;
alter table public.giveaway_winners enable row level security;
alter table public.testimonies enable row level security;
alter table public.testimony_responses enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_sessions enable row level security;
alter table public.financial_ledger_entries enable row level security;

-- Polls are visible in their permitted scope. Creation is an authorized publishing action.
create policy polls_read on public.polls for select using (
  organization_id is not null and (
    (branch_id is null and (visibility = 'public' or public.is_organization_member(organization_id)))
    or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
  )
);
create policy polls_manage on public.polls for all to authenticated using (
  public.has_permission(organization_id, 'polls.manage', branch_id)
) with check (
  author_profile_id = auth.uid() and public.has_permission(organization_id, 'polls.manage', branch_id)
);
create policy poll_options_read on public.poll_options for select using (exists(select 1 from public.polls p where p.id = poll_id));
create policy poll_options_manage on public.poll_options for all to authenticated using (
  exists(select 1 from public.polls p where p.id = poll_id and public.has_permission(p.organization_id, 'polls.manage', p.branch_id))
) with check (
  exists(select 1 from public.polls p where p.id = poll_id and public.has_permission(p.organization_id, 'polls.manage', p.branch_id))
);
create policy poll_votes_read on public.poll_votes for select using (exists(select 1 from public.polls p where p.id = poll_id));
create policy poll_votes_own on public.poll_votes for all to authenticated using (profile_id = auth.uid()) with check (
  profile_id = auth.uid() and exists(
    select 1 from public.polls p
    where p.id = poll_id and p.status = 'open' and (p.closes_at is null or p.closes_at > now())
      and ((p.branch_id is null and public.is_organization_member(p.organization_id)) or (p.branch_id is not null and public.is_expression_member(p.organization_id, p.branch_id)))
  )
);

-- Any authenticated member in the target scope may host/enter a giveaway; only its host selects winners.
create policy giveaways_read on public.giveaways for select using (
  (branch_id is null and (visibility = 'public' or public.is_organization_member(organization_id)))
  or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
);
create policy giveaways_create on public.giveaways for insert to authenticated with check (
  host_profile_id = auth.uid() and ((branch_id is null and public.is_organization_member(organization_id)) or (branch_id is not null and public.is_expression_member(organization_id, branch_id)))
);
create policy giveaways_host_update on public.giveaways for update to authenticated using (host_profile_id = auth.uid()) with check (host_profile_id = auth.uid());
create policy giveaway_entries_read on public.giveaway_entries for select using (exists(select 1 from public.giveaways g where g.id = giveaway_id));
create policy giveaway_entries_own on public.giveaway_entries for insert to authenticated with check (
  profile_id = auth.uid() and exists(select 1 from public.giveaways g where g.id = giveaway_id and g.status = 'open' and (g.closes_at is null or g.closes_at > now()))
);
create policy giveaway_winners_read on public.giveaway_winners for select using (exists(select 1 from public.giveaways g where g.id = giveaway_id));
create policy giveaway_winners_host on public.giveaway_winners for insert to authenticated with check (
  selected_by = auth.uid() and exists(select 1 from public.giveaways g where g.id = giveaway_id and g.host_profile_id = auth.uid())
);

-- Testimony is Expression-only and private by default: submitter + authorized reviewers.
create policy testimonies_private_read on public.testimonies for select to authenticated using (
  author_profile_id = auth.uid()
  or public.has_permission(organization_id, 'testimonies.review', branch_id)
  or public.has_permission(organization_id, 'testimonies.manage', branch_id)
);
create policy testimonies_submit on public.testimonies for insert to authenticated with check (
  author_profile_id = auth.uid() and public.is_expression_member(organization_id, branch_id)
);
create policy testimonies_author_draft_update on public.testimonies for update to authenticated using (
  author_profile_id = auth.uid() and status in ('draft','submitted')
) with check (author_profile_id = auth.uid());
create policy testimonies_staff_update on public.testimonies for update to authenticated using (
  public.has_permission(organization_id, 'testimonies.manage', branch_id)
) with check (public.has_permission(organization_id, 'testimonies.manage', branch_id));
create policy testimony_responses_read on public.testimony_responses for select to authenticated using (
  exists(select 1 from public.testimonies t where t.id = testimony_id and (t.author_profile_id = auth.uid() or public.has_permission(t.organization_id, 'testimonies.review', t.branch_id) or public.has_permission(t.organization_id, 'testimonies.manage', t.branch_id)))
);
create policy testimony_responses_staff on public.testimony_responses for insert to authenticated with check (
  responder_profile_id = auth.uid() and exists(select 1 from public.testimonies t where t.id = testimony_id and (public.has_permission(t.organization_id, 'testimonies.review', t.branch_id) or public.has_permission(t.organization_id, 'testimonies.manage', t.branch_id)))
);

-- Finance is deliberately private to authorized roles. General/public finance is excluded;
-- records are designed for Expressions, with nullable branch only for future platform clearing.
create policy financial_accounts_read on public.financial_accounts for select to authenticated using (
  branch_id is not null and public.has_permission(organization_id, 'finance.read', branch_id)
);
create policy financial_accounts_manage on public.financial_accounts for all to authenticated using (
  branch_id is not null and public.has_permission(organization_id, 'finance.manage', branch_id)
) with check (
  branch_id is not null and public.has_permission(organization_id, 'finance.manage', branch_id)
);
create policy financial_sessions_read on public.financial_sessions for select to authenticated using (
  public.has_permission(organization_id, 'finance.read', branch_id)
);
create policy financial_sessions_manage on public.financial_sessions for all to authenticated using (
  public.has_permission(organization_id, 'finance.manage', branch_id)
) with check (
  public.has_permission(organization_id, 'finance.manage', branch_id)
);
create policy financial_ledger_read on public.financial_ledger_entries for select to authenticated using (
  branch_id is not null and public.has_permission(organization_id, 'finance.read', branch_id)
);
create policy financial_ledger_insert on public.financial_ledger_entries for insert to authenticated with check (
  branch_id is not null and recorded_by = auth.uid() and public.has_permission(organization_id, 'finance.manage', branch_id)
);

revoke update, delete on public.financial_ledger_entries from authenticated;
grant select on public.financial_account_balances to authenticated;
