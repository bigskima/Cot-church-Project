-- Provider-neutral AI control-plane with capability routing, budget enforcement, audit and human approval.
create type public.ai_run_status as enum('queued','running','succeeded','failed','requires_review','approved','rejected');
create type public.ai_provider_status as enum('active','disabled','degraded');
insert into public.permissions(code,name,description,category) values
 ('ai.use','Use church AI assistant','Use approved AI capabilities with current tenant scope.','intelligence'),
 ('ai.configure','Configure AI routing','Configure AI providers, models, prompts, limits and fallbacks.','intelligence'),
 ('ai.review','Review generated content','Approve or reject AI-generated church content.','intelligence')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

create table public.ai_providers(
 id uuid primary key default gen_random_uuid(), code text not null unique check(code in('openai','gemini','anthropic')), name text not null,
 adapter_version text not null, status public.ai_provider_status not null default 'active', secret_reference text not null,
 configuration jsonb not null default '{}' check(jsonb_typeof(configuration)='object'), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ai_models(
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.ai_providers(id) on delete cascade,
 model_key text not null, display_name text not null, input_cost_per_million numeric not null default 0, output_cost_per_million numeric not null default 0,
 context_window integer, is_active boolean not null default true, configuration jsonb not null default '{}', unique(provider_id,model_key)
);
create table public.ai_capabilities(
 code text primary key, name text not null, risk_level text not null check(risk_level in('low','medium','high','pastoral')),
 requires_human_review boolean not null default false, description text not null
);
create table public.ai_routes(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
 capability_code text not null references public.ai_capabilities(code), primary_model_id uuid not null references public.ai_models(id),
 fallback_model_ids uuid[] not null default '{}', timeout_ms integer not null default 30000 check(timeout_ms between 1000 and 300000),
 max_retries integer not null default 1 check(max_retries between 0 and 3), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique nulls not distinct(organization_id,capability_code)
);
create table public.ai_prompt_templates(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
 capability_code text not null references public.ai_capabilities(code), code text not null, version integer not null,
 system_prompt text not null, input_schema jsonb not null default '{}', output_schema jsonb not null default '{}', is_active boolean not null default true,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), unique nulls not distinct(organization_id,code,version)
);
create table public.ai_usage_limits(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
 capability_code text references public.ai_capabilities(code), period text not null check(period in('day','month')),
 max_requests integer, max_tokens bigint, max_cost_minor bigint, currency text not null default 'USD', is_active boolean not null default true,
 unique nulls not distinct(organization_id,capability_code,period)
);
create table public.ai_generation_runs(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
 profile_id uuid references public.profiles(id) on delete set null, capability_code text not null references public.ai_capabilities(code),
 route_id uuid references public.ai_routes(id), model_id uuid references public.ai_models(id), prompt_template_id uuid references public.ai_prompt_templates(id),
 status public.ai_run_status not null default 'queued', input_sha256 text not null, scoped_entity_type text, scoped_entity_id text,
 input_tokens integer, output_tokens integer, estimated_cost_minor bigint, latency_ms integer, provider_request_id text,
 output jsonb, error_code text, error_message text, fallback_count integer not null default 0,
 created_at timestamptz not null default now(), completed_at timestamptz, approved_by uuid references public.profiles(id), approved_at timestamptz
);
create table public.ai_content_drafts(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 run_id uuid not null references public.ai_generation_runs(id) on delete restrict, content_type text not null,
 title text, content jsonb not null, status public.ai_run_status not null default 'requires_review', created_by uuid references public.profiles(id),
 reviewed_by uuid references public.profiles(id), review_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.ai_capabilities(code,name,risk_level,requires_human_review,description) values
 ('assistant.answer','Church assistant','medium',false,'Answer from verified platform context.'),
 ('sermon.transcribe','Sermon transcription','medium',false,'Transcribe authorized sermon media.'),
 ('sermon.summarize','Sermon intelligence','medium',true,'Create summaries, lessons, references and drafts.'),
 ('live.caption','Live captions','medium',false,'Produce captions for authorized broadcasts.'),
 ('translate.text','Translation','medium',false,'Translate approved content.'),
 ('search.embed','Semantic search','low',false,'Create embeddings for permitted content.'),
 ('content.moderate','Moderation suggestions','high',true,'Suggest moderation outcomes for human review.'),
 ('pastoral.triage','Prayer follow-up suggestions','pastoral',true,'Suggest private classifications for authorized pastoral review.'),
 ('admin.insight','Administrative copilot','high',true,'Summarize tenant-scoped operational trends.') on conflict(code) do nothing;

create index ai_runs_usage_idx on public.ai_generation_runs(organization_id,capability_code,created_at desc);
create index ai_runs_failures_idx on public.ai_generation_runs(created_at desc) where status='failed';
create index ai_drafts_review_idx on public.ai_content_drafts(organization_id,status,created_at);
create trigger ai_providers_updated before update on public.ai_providers for each row execute function public.set_updated_at();
create trigger ai_routes_updated before update on public.ai_routes for each row execute function public.set_updated_at();
create trigger ai_drafts_updated before update on public.ai_content_drafts for each row execute function public.set_updated_at();
alter table public.ai_providers enable row level security; alter table public.ai_models enable row level security; alter table public.ai_capabilities enable row level security;
alter table public.ai_routes enable row level security; alter table public.ai_prompt_templates enable row level security; alter table public.ai_usage_limits enable row level security;
alter table public.ai_generation_runs enable row level security; alter table public.ai_content_drafts enable row level security;
create policy ai_capabilities_read on public.ai_capabilities for select to authenticated using(true);
create policy ai_runs_self on public.ai_generation_runs for select to authenticated using(profile_id=auth.uid());
create policy ai_runs_review on public.ai_generation_runs for select to authenticated using(organization_id is not null and public.has_permission(organization_id,'ai.review'));
create policy ai_drafts_review on public.ai_content_drafts for select to authenticated using(public.has_permission(organization_id,'ai.review'));
revoke all on public.ai_providers,public.ai_models,public.ai_routes,public.ai_prompt_templates,public.ai_usage_limits from anon,authenticated;
grant select on public.ai_capabilities,public.ai_generation_runs,public.ai_content_drafts to authenticated;
