alter table public.analytics_events_default enable row level security;

revoke all on table public.analytics_events_default from anon, authenticated;
grant all on table public.analytics_events_default to service_role;

drop policy if exists analytics_events_default_no_client_access
  on public.analytics_events_default;

create policy analytics_events_default_no_client_access
  on public.analytics_events_default
  for all
  to anon, authenticated
  using (false)
  with check (false);
