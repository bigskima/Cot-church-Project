-- Support profile lifecycle cleanup and sparse approval references on AI run history.

create index if not exists ai_runs_profile_created_idx
  on public.ai_generation_runs (profile_id, created_at desc)
  where profile_id is not null;

create index if not exists ai_runs_approved_by_idx
  on public.ai_generation_runs (approved_by)
  where approved_by is not null;
