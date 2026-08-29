-- Phase 3 completion: workflow engine, analytics, integrations, live streams, and scoped social feed.

create type public.workflow_run_status as enum ('queued','running','succeeded','failed','cancelled','dead_letter');
create type public.integration_status as enum ('active','disabled','error');
create type public.stream_status as enum ('draft','scheduled','live','ended','cancelled','archived');
create type public.content_visibility as enum ('public','organization','branch','group','private');
create type public.post_status as enum ('draft','published','hidden','archived');

insert into public.permissions(code,name,description,category) values
 ('workflows.manage','Manage workflows','Configure and inspect organization workflows.','automation'),
 ('reports.read','View reports','View organization operational analytics.','reports'),
 ('integrations.manage','Manage integrations','Configure and inspect external integrations.','integrations'),
 ('streams.manage','Manage live streams','Schedule, start, end, and archive streams.','media'),
 ('feed.post','Publish feed content','Publish content into permitted feed scopes.','social'),
 ('feed.moderate','Moderate feed content','Hide, restore, and moderate social content.','social')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

create table public.domain_events(
 id bigint generated always as identity primary key, organization_id uuid references public.organizations(id) on delete cascade,
 event_type text not null, schema_version integer not null default 1, aggregate_type text not null, aggregate_id text not null,
 actor_profile_id uuid references public.profiles(id) on delete set null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 deduplication_key text not null unique, occurred_at timestamptz not null default now()
);
create table public.workflow_definitions(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 code text not null, name text not null, trigger_event_type text not null, definition jsonb not null check(jsonb_typeof(definition)='object'),
 is_active boolean not null default true, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,code,version),unique(id,organization_id)
);
create table public.workflow_runs(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 workflow_definition_id uuid not null, domain_event_id bigint references public.domain_events(id) on delete restrict,
 status public.workflow_run_status not null default 'queued', state jsonb not null default '{}'::jsonb,
 attempts integer not null default 0, available_at timestamptz not null default now(), locked_at timestamptz, started_at timestamptz, completed_at timestamptz,last_error text,created_at timestamptz not null default now(),
 foreign key(workflow_definition_id,organization_id) references public.workflow_definitions(id,organization_id) on delete restrict
);
create table public.integration_connections(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 provider text not null, name text not null, status public.integration_status not null default 'active', configuration jsonb not null default '{}'::jsonb,
 secret_reference text, last_success_at timestamptz,last_error_at timestamptz,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,provider,name),unique(id,organization_id)
);
create table public.integration_deliveries(
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null, domain_event_id bigint references public.domain_events(id) on delete restrict,status public.workflow_run_status not null default 'queued',
 idempotency_key text not null unique,payload jsonb not null,attempts integer not null default 0,available_at timestamptz not null default now(),locked_at timestamptz,response_code integer,response_body_sha256 text,last_error text,completed_at timestamptz,created_at timestamptz not null default now(),
 foreign key(connection_id,organization_id) references public.integration_connections(id,organization_id) on delete cascade
);

create table public.live_streams(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 branch_id uuid,event_id uuid,title text not null check(char_length(trim(title)) between 1 and 180),description text not null default '',
 status public.stream_status not null default 'draft',visibility public.content_visibility not null default 'organization',
 provider text not null,provider_stream_id text,playback_url text,playback_token_required boolean not null default true,
 scheduled_start timestamptz,started_at timestamptz,ended_at timestamptz,recording_url text,thumbnail_url text,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,organization_id),
 foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete restrict,
 foreign key(event_id,organization_id) references public.events(id,organization_id) on delete restrict
);
create table public.stream_viewer_sessions(
 id uuid primary key default gen_random_uuid(),stream_id uuid not null,organization_id uuid not null references public.organizations(id) on delete cascade,
 profile_id uuid references public.profiles(id) on delete set null,anonymous_session_hash text,joined_at timestamptz not null default now(),left_at timestamptz,last_heartbeat_at timestamptz not null default now(),watch_seconds integer not null default 0,
 foreign key(stream_id,organization_id) references public.live_streams(id,organization_id) on delete cascade,check(profile_id is not null or anonymous_session_hash is not null)
);

create table public.social_posts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 author_membership_id uuid not null,branch_id uuid,group_id uuid,visibility public.content_visibility not null default 'organization',
 status public.post_status not null default 'published',body text not null check(char_length(trim(body)) between 1 and 10000),media jsonb not null default '[]'::jsonb check(jsonb_typeof(media)='array'),
 published_at timestamptz not null default now(),edited_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,organization_id),
 foreign key(author_membership_id,organization_id) references public.memberships(id,organization_id) on delete restrict,
 foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete restrict,
 foreign key(group_id,organization_id) references public.groups(id,organization_id) on delete restrict,
 check((visibility='branch')=(branch_id is not null) or visibility<>'branch'),check((visibility='group')=(group_id is not null) or visibility<>'group')
);
create table public.social_comments(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 post_id uuid not null,author_membership_id uuid not null,parent_comment_id uuid,
 body text not null check(char_length(trim(body)) between 1 and 3000),is_hidden boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),foreign key(post_id,organization_id) references public.social_posts(id,organization_id) on delete cascade,
 foreign key(parent_comment_id,organization_id) references public.social_comments(id,organization_id) on delete cascade,
 foreign key(author_membership_id,organization_id) references public.memberships(id,organization_id) on delete restrict
);
create table public.social_reactions(
 organization_id uuid not null references public.organizations(id) on delete cascade,post_id uuid not null,membership_id uuid not null,reaction text not null check(reaction in('like','love','pray','celebrate','support')),created_at timestamptz not null default now(),
 primary key(post_id,membership_id),foreign key(post_id,organization_id) references public.social_posts(id,organization_id) on delete cascade,foreign key(membership_id,organization_id) references public.memberships(id,organization_id) on delete cascade
);
create table public.analytics_events(
 id bigint generated always as identity,organization_id uuid references public.organizations(id) on delete cascade,profile_id uuid references public.profiles(id) on delete set null,
 event_name text not null,entity_type text,entity_id text,properties jsonb not null default '{}'::jsonb,occurred_at timestamptz not null default now(),primary key(id,occurred_at)
) partition by range(occurred_at);
create table public.analytics_events_default partition of public.analytics_events default;
create table public.daily_organization_metrics(
 organization_id uuid not null references public.organizations(id) on delete cascade,metric_date date not null,metric_name text not null,dimension jsonb not null default '{}'::jsonb,value numeric not null,updated_at timestamptz not null default now(),primary key(organization_id,metric_date,metric_name,dimension)
);

create index workflow_runs_claim_idx on public.workflow_runs(status,available_at) where status in('queued','failed');
create index integration_deliveries_claim_idx on public.integration_deliveries(status,available_at) where status in('queued','failed');
create index streams_schedule_idx on public.live_streams(organization_id,status,scheduled_start);
create index stream_sessions_stream_idx on public.stream_viewer_sessions(stream_id,joined_at);
create index social_feed_idx on public.social_posts(organization_id,status,published_at desc);
create index social_comments_post_idx on public.social_comments(post_id,created_at);
create index analytics_events_lookup_idx on public.analytics_events_default(organization_id,event_name,occurred_at desc);
create trigger workflow_definitions_updated before update on public.workflow_definitions for each row execute function public.set_updated_at();
create trigger integration_connections_updated before update on public.integration_connections for each row execute function public.set_updated_at();
create trigger live_streams_updated before update on public.live_streams for each row execute function public.set_updated_at();
create trigger social_posts_updated before update on public.social_posts for each row execute function public.set_updated_at();
create trigger social_comments_updated before update on public.social_comments for each row execute function public.set_updated_at();

create function public.can_read_social_scope(target_organization_id uuid,target_visibility public.content_visibility,target_branch_id uuid,target_group_id uuid)
returns boolean language sql stable security definer set search_path='' as $$ select case target_visibility when 'public' then true when 'organization' then public.is_organization_member(target_organization_id) when 'branch' then exists(select 1 from public.memberships where organization_id=target_organization_id and profile_id=auth.uid() and status='active' and branch_id=target_branch_id) when 'group' then exists(select 1 from public.group_memberships gm join public.memberships m on m.id=gm.membership_id where gm.group_id=target_group_id and gm.status='active' and m.profile_id=auth.uid()) when 'private' then false else false end; $$;

alter table public.domain_events enable row level security;alter table public.workflow_definitions enable row level security;alter table public.workflow_runs enable row level security;
alter table public.integration_connections enable row level security;alter table public.integration_deliveries enable row level security;alter table public.live_streams enable row level security;alter table public.stream_viewer_sessions enable row level security;
alter table public.social_posts enable row level security;alter table public.social_comments enable row level security;alter table public.social_reactions enable row level security;alter table public.analytics_events enable row level security;alter table public.daily_organization_metrics enable row level security;
create policy workflows_admin on public.workflow_definitions for all to authenticated using(public.has_permission(organization_id,'workflows.manage')) with check(public.has_permission(organization_id,'workflows.manage'));
create policy workflow_runs_admin on public.workflow_runs for select to authenticated using(public.has_permission(organization_id,'workflows.manage'));
create policy integrations_admin on public.integration_connections for all to authenticated using(public.has_permission(organization_id,'integrations.manage')) with check(public.has_permission(organization_id,'integrations.manage'));
create policy integration_deliveries_admin on public.integration_deliveries for select to authenticated using(public.has_permission(organization_id,'integrations.manage'));
create policy streams_public_read on public.live_streams for select to anon,authenticated using(status in('scheduled','live','ended') and visibility='public');
create policy streams_member_read on public.live_streams for select to authenticated using(public.is_organization_member(organization_id) and status<>'draft');
create policy streams_manage on public.live_streams for all to authenticated using(public.has_permission(organization_id,'streams.manage',branch_id)) with check(public.has_permission(organization_id,'streams.manage',branch_id));
create policy stream_sessions_self on public.stream_viewer_sessions for select to authenticated using(profile_id=auth.uid());
create policy posts_public_read on public.social_posts for select to anon,authenticated using(status='published' and visibility='public');
create policy posts_scoped_read on public.social_posts for select to authenticated using(status='published' and public.can_read_social_scope(organization_id,visibility,branch_id,group_id));
create policy posts_author_read on public.social_posts for select to authenticated using(exists(select 1 from public.memberships m where m.id=author_membership_id and m.profile_id=auth.uid()));
create policy posts_author_update on public.social_posts for update to authenticated using(exists(select 1 from public.memberships m where m.id=author_membership_id and m.profile_id=auth.uid())) with check(exists(select 1 from public.memberships m where m.id=author_membership_id and m.profile_id=auth.uid()));
create policy comments_post_read on public.social_comments for select to authenticated using(exists(select 1 from public.social_posts p where p.id=post_id and public.can_read_social_scope(p.organization_id,p.visibility,p.branch_id,p.group_id)));
create policy reactions_post_read on public.social_reactions for select to authenticated using(exists(select 1 from public.social_posts p where p.id=post_id and public.can_read_social_scope(p.organization_id,p.visibility,p.branch_id,p.group_id)));
create policy metrics_report_read on public.daily_organization_metrics for select to authenticated using(public.has_permission(organization_id,'reports.read'));

create function public.publish_social_post(target_organization_id uuid,target_visibility public.content_visibility,post_body text,target_branch_id uuid default null,target_group_id uuid default null,post_media jsonb default '[]'::jsonb)
returns public.social_posts language plpgsql security definer set search_path='' as $$ declare member public.memberships;result public.social_posts;begin
 select * into member from public.memberships where organization_id=target_organization_id and profile_id=auth.uid() and status='active';if not found then raise exception using errcode='42501',message='Active membership required';end if;
 if not public.has_permission(target_organization_id,'feed.post',target_branch_id) then raise exception using errcode='42501',message='Permission denied';end if;
 if target_visibility='branch' and (target_branch_id is null or member.branch_id<>target_branch_id) and not public.has_permission(target_organization_id,'feed.moderate',target_branch_id) then raise exception using errcode='42501',message='Branch access denied';end if;
 if target_visibility='group' and not exists(select 1 from public.group_memberships where group_id=target_group_id and membership_id=member.id and status='active') then raise exception using errcode='42501',message='Group access denied';end if;
 insert into public.social_posts(organization_id,author_membership_id,branch_id,group_id,visibility,body,media) values(target_organization_id,member.id,target_branch_id,target_group_id,target_visibility,trim(post_body),post_media) returning * into result;
 insert into public.domain_events(organization_id,event_type,aggregate_type,aggregate_id,actor_profile_id,payload,deduplication_key) values(target_organization_id,'social.post.published','social_post',result.id::text,auth.uid(),jsonb_build_object('postId',result.id,'visibility',result.visibility),'social-post:'||result.id);return result;end;$$;

create function public.comment_on_social_post(target_post_id uuid,comment_body text,target_parent_comment_id uuid default null) returns public.social_comments language plpgsql security definer set search_path='' as $$ declare post public.social_posts;member public.memberships;result public.social_comments;begin select * into post from public.social_posts where id=target_post_id and status='published';if not found then raise exception using errcode='P0002',message='Post not found';end if;select * into member from public.memberships where organization_id=post.organization_id and profile_id=auth.uid() and status='active';if not found then raise exception using errcode='42501',message='Active membership required';end if;if not public.can_read_social_scope(post.organization_id,post.visibility,post.branch_id,post.group_id) and member.id<>post.author_membership_id then raise exception using errcode='42501',message='Post access denied';end if;if target_parent_comment_id is not null and not exists(select 1 from public.social_comments where id=target_parent_comment_id and post_id=target_post_id) then raise exception using errcode='22023',message='Invalid parent comment';end if;insert into public.social_comments(organization_id,post_id,author_membership_id,parent_comment_id,body) values(post.organization_id,post.id,member.id,target_parent_comment_id,trim(comment_body)) returning * into result;return result;end;$$;

create function public.react_to_social_post(target_post_id uuid,target_reaction text) returns public.social_reactions language plpgsql security definer set search_path='' as $$ declare post public.social_posts;member public.memberships;result public.social_reactions;begin select * into post from public.social_posts where id=target_post_id and status='published';if not found or not public.can_read_social_scope(post.organization_id,post.visibility,post.branch_id,post.group_id) then raise exception using errcode='42501',message='Post access denied';end if;select * into member from public.memberships where organization_id=post.organization_id and profile_id=auth.uid() and status='active';if target_reaction not in('like','love','pray','celebrate','support') then raise exception using errcode='22023',message='Invalid reaction';end if;insert into public.social_reactions(organization_id,post_id,membership_id,reaction) values(post.organization_id,post.id,member.id,target_reaction) on conflict(post_id,membership_id) do update set reaction=excluded.reaction,created_at=now() returning * into result;return result;end;$$;

create function public.claim_workflow_runs(batch_size integer default 25) returns setof public.workflow_runs language plpgsql security definer set search_path='' as $$ begin
 update public.workflow_runs set status='dead_letter',locked_at=null where status='failed' and attempts>=10;
 return query with jobs as(select id from public.workflow_runs where status in('queued','failed') and available_at<=now() and attempts<10 order by available_at for update skip locked limit least(greatest(batch_size,1),100)) update public.workflow_runs r set status='running',locked_at=now(),started_at=coalesce(started_at,now()),attempts=attempts+1 from jobs where r.id=jobs.id returning r.*;end;$$;

create function public.enqueue_domain_event_work() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.workflow_runs(organization_id,workflow_definition_id,domain_event_id,state)
 select d.organization_id,d.id,new.id,jsonb_build_object('eventType',new.event_type,'payload',new.payload) from public.workflow_definitions d where d.organization_id=new.organization_id and d.trigger_event_type=new.event_type and d.is_active;
 insert into public.integration_deliveries(organization_id,connection_id,domain_event_id,idempotency_key,payload)
 select c.organization_id,c.id,new.id,'integration:'||c.id||':event:'||new.id,jsonb_build_object('eventType',new.event_type,'schemaVersion',new.schema_version,'aggregateType',new.aggregate_type,'aggregateId',new.aggregate_id,'payload',new.payload)
 from public.integration_connections c where c.organization_id=new.organization_id and c.status='active' and coalesce(c.configuration->'eventTypes','[]'::jsonb) ? new.event_type;
 return new;end;$$;
create trigger domain_events_enqueue_work after insert on public.domain_events for each row execute function public.enqueue_domain_event_work();

create function public.claim_integration_deliveries(batch_size integer default 25) returns setof public.integration_deliveries language plpgsql security definer set search_path='' as $$ begin
 update public.integration_deliveries set status='dead_letter',locked_at=null where status='failed' and attempts>=10;
 return query with jobs as(select id from public.integration_deliveries where status in('queued','failed') and available_at<=now() and attempts<10 order by available_at for update skip locked limit least(greatest(batch_size,1),100)) update public.integration_deliveries d set status='running',locked_at=now(),attempts=attempts+1 from jobs where d.id=jobs.id returning d.*;end;$$;

create function public.refresh_daily_analytics(target_date date) returns integer language plpgsql security definer set search_path='' as $$ declare affected integer;begin
 insert into public.daily_organization_metrics(organization_id,metric_date,metric_name,dimension,value)
 select organization_id,target_date,event_name,'{}'::jsonb,count(*) from public.analytics_events where occurred_at>=target_date::timestamptz and occurred_at<(target_date+1)::timestamptz and organization_id is not null group by organization_id,event_name
 on conflict(organization_id,metric_date,metric_name,dimension) do update set value=excluded.value,updated_at=now();get diagnostics affected=row_count;return affected;end;$$;

create function public.organization_dashboard(target_organization_id uuid,period_start timestamptz,period_end timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin if not public.has_permission(target_organization_id,'reports.read') then raise exception using errcode='42501',message='Permission denied';end if;if period_end<=period_start or period_end-period_start>interval '2 years' then raise exception using errcode='22023',message='Invalid period';end if;return jsonb_build_object(
 'members',(select count(*) from public.memberships where organization_id=target_organization_id and status='active'),
 'events',(select count(*) from public.events where organization_id=target_organization_id and starts_at>=period_start and starts_at<period_end),
 'attendance',(select count(*) from public.attendance_records where organization_id=target_organization_id and checked_in_at>=period_start and checked_in_at<period_end),
 'giving',(select coalesce(jsonb_object_agg(currency,total), '{}'::jsonb) from(select currency,sum(amount_minor) total from public.donations where organization_id=target_organization_id and status='succeeded' and succeeded_at>=period_start and succeeded_at<period_end group by currency)g),
 'engagement',(select jsonb_build_object('posts',count(*),'reactions',(select count(*) from public.social_reactions where organization_id=target_organization_id)) from public.social_posts where organization_id=target_organization_id and published_at>=period_start and published_at<period_end));end;$$;

revoke all on function public.can_read_social_scope(uuid,public.content_visibility,uuid,uuid) from public;revoke all on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) from public;revoke all on function public.comment_on_social_post(uuid,text,uuid) from public;revoke all on function public.react_to_social_post(uuid,text) from public;revoke all on function public.claim_workflow_runs(integer) from public;revoke all on function public.claim_integration_deliveries(integer) from public;revoke all on function public.refresh_daily_analytics(date) from public;revoke all on function public.organization_dashboard(uuid,timestamptz,timestamptz) from public;
grant execute on function public.can_read_social_scope(uuid,public.content_visibility,uuid,uuid) to anon,authenticated;grant execute on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) to authenticated;grant execute on function public.comment_on_social_post(uuid,text,uuid) to authenticated;grant execute on function public.react_to_social_post(uuid,text) to authenticated;grant execute on function public.claim_workflow_runs(integer) to service_role;grant execute on function public.claim_integration_deliveries(integer) to service_role;grant execute on function public.refresh_daily_analytics(date) to service_role;grant execute on function public.organization_dashboard(uuid,timestamptz,timestamptz) to authenticated;
create trigger audit_workflow_definitions after insert or update or delete on public.workflow_definitions for each row execute function public.audit_row_change();
create trigger audit_streams after insert or update or delete on public.live_streams for each row execute function public.audit_row_change();
create function public.audit_platform_metadata() returns trigger language plpgsql security definer set search_path='' as $$ declare before_meta jsonb;after_meta jsonb;tenant uuid;target text;begin tenant:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;target:=case when tg_op='DELETE' then old.id::text else new.id::text end;if tg_table_name='integration_connections' then before_meta:=case when tg_op in('UPDATE','DELETE') then jsonb_build_object('provider',old.provider,'name',old.name,'status',old.status) end;after_meta:=case when tg_op in('INSERT','UPDATE') then jsonb_build_object('provider',new.provider,'name',new.name,'status',new.status) end;else before_meta:=case when tg_op in('UPDATE','DELETE') then jsonb_build_object('visibility',old.visibility,'status',old.status) end;after_meta:=case when tg_op in('INSERT','UPDATE') then jsonb_build_object('visibility',new.visibility,'status',new.status) end;end if;insert into public.audit_log(organization_id,actor_profile_id,action,target_type,target_id,old_values,new_values)values(tenant,auth.uid(),lower(tg_op),tg_table_name,target,before_meta,after_meta);if tg_op='DELETE' then return old;end if;return new;end;$$;
revoke all on function public.audit_platform_metadata() from public;
create trigger audit_integrations after insert or update or delete on public.integration_connections for each row execute function public.audit_platform_metadata();
create trigger audit_social_posts after insert or update or delete on public.social_posts for each row execute function public.audit_platform_metadata();
