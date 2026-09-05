-- Put analytics indexes on the partitioned parent so current and future
-- partitions share the same lookup and maintenance paths.

create index if not exists analytics_events_scope_time_idx
  on public.analytics_events (organization_id, event_name, occurred_at desc);

create index if not exists analytics_events_time_scope_idx
  on public.analytics_events (occurred_at, organization_id, event_name);

create index if not exists analytics_events_profile_time_idx
  on public.analytics_events (profile_id, occurred_at desc)
  where profile_id is not null;
