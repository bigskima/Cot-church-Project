-- Support Platform Overview and AI control-plane telemetry without
-- full scans as AI generation history grows.

create index if not exists ai_runs_recent_idx
  on public.ai_generation_runs (created_at desc);

create index if not exists ai_runs_status_created_idx
  on public.ai_generation_runs (status, created_at desc);

drop index if exists public.ai_runs_failures_idx;
