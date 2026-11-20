-- Secure, provider-neutral live participation, attendance, chat, reactions and private ministry follow-up.
alter table public.live_streams add column group_id uuid;
alter table public.live_streams add constraint live_streams_group_tenant_fk foreign key(group_id,organization_id) references public.groups(id,organization_id) on delete restrict;

create type public.live_follow_up_type as enum ('prayer_request','altar_response','counselling','membership_interest');
create type public.live_follow_up_status as enum ('new','assigned','contacted','resolved','closed');

create table public.stream_messages (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 stream_id uuid not null, membership_id uuid not null, body text not null check(char_length(trim(body)) between 1 and 1000),
 is_hidden boolean not null default false, hidden_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 foreign key(stream_id,organization_id) references public.live_streams(id,organization_id) on delete cascade,
 foreign key(membership_id,organization_id) references public.memberships(id,organization_id) on delete cascade
);
create table public.stream_reactions (
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
 stream_id uuid not null, profile_id uuid references public.profiles(id) on delete set null,
 reaction text not null check(reaction in ('heart','prayer','fire','amen')), created_at timestamptz not null default now(),
 foreign key(stream_id,organization_id) references public.live_streams(id,organization_id) on delete cascade
);
create table public.live_follow_ups (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 stream_id uuid not null, profile_id uuid not null references public.profiles(id) on delete cascade, branch_id uuid,
 type public.live_follow_up_type not null, status public.live_follow_up_status not null default 'new', private_note text not null default '',
 assigned_to uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(stream_id,organization_id) references public.live_streams(id,organization_id) on delete cascade,
 foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete restrict
);
create index stream_messages_timeline_idx on public.stream_messages(stream_id,created_at desc) where not is_hidden;
create index stream_reactions_window_idx on public.stream_reactions(stream_id,created_at desc);
create index live_follow_ups_queue_idx on public.live_follow_ups(organization_id,status,created_at);
create trigger live_follow_ups_updated before update on public.live_follow_ups for each row execute function public.set_updated_at();

alter table public.stream_messages enable row level security; alter table public.stream_reactions enable row level security; alter table public.live_follow_ups enable row level security;
drop policy if exists streams_member_read on public.live_streams;
create policy streams_scoped_member_read on public.live_streams for select to authenticated using(
 status <> 'draft' and (visibility in ('public','organization') and public.is_organization_member(organization_id)
 or visibility='branch' and exists(select 1 from public.memberships m where m.organization_id=live_streams.organization_id and m.profile_id=auth.uid() and m.status='active' and m.branch_id=live_streams.branch_id)
 or visibility='group' and exists(select 1 from public.group_memberships gm join public.memberships m on m.id=gm.membership_id where gm.group_id=live_streams.group_id and m.profile_id=auth.uid() and gm.status='active'))
);
create policy stream_messages_read on public.stream_messages for select to authenticated using(exists(select 1 from public.live_streams s where s.id=stream_id and (s.visibility='public' or public.is_organization_member(s.organization_id))));
create policy stream_reactions_read on public.stream_reactions for select to authenticated using(exists(select 1 from public.live_streams s where s.id=stream_id and (s.visibility='public' or public.is_organization_member(s.organization_id))));
create policy follow_ups_self_read on public.live_follow_ups for select to authenticated using(profile_id=auth.uid());
create policy follow_ups_ministry_read on public.live_follow_ups for select to authenticated using(public.has_permission(organization_id,'prayer.manage',branch_id) or public.has_permission(organization_id,'memberships.manage',branch_id));

create function public.can_access_stream(target_stream_id uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare s public.live_streams; member public.memberships;
begin select * into s from public.live_streams where id=target_stream_id and status in('scheduled','live','ended'); if not found then return false; end if;
 if s.visibility='public' then return true; end if;
 select * into member from public.memberships where organization_id=s.organization_id and profile_id=auth.uid() and status='active'; if not found then return false; end if;
 if s.visibility='organization' then return true; end if; if s.visibility='branch' then return member.branch_id=s.branch_id; end if;
 if s.visibility='group' then return exists(select 1 from public.group_memberships gm where gm.membership_id=member.id and gm.status='active' and gm.group_id=s.group_id); end if;
 return public.has_permission(s.organization_id,'streams.manage',s.branch_id); end;$$;

create function public.begin_stream_session(target_stream_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.live_streams; session_id uuid;
begin if not public.can_access_stream(target_stream_id) then raise exception using errcode='42501',message='Stream access denied'; end if;
 select * into s from public.live_streams where id=target_stream_id;
 if s.status='live' then insert into public.stream_viewer_sessions(stream_id,organization_id,profile_id) values(s.id,s.organization_id,auth.uid()) returning id into session_id; end if;
 return jsonb_build_object('stream',jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'status',s.status,'visibility',s.visibility),'playbackUrl',case when s.status in('live','ended') then coalesce(s.playback_url,s.recording_url) end,'viewerSessionId',session_id,'canChat',s.status='live' and auth.uid() is not null,'givingEnabled',true); end;$$;

create function public.update_stream_presence(target_session_id uuid,presence_action text) returns public.stream_viewer_sessions language plpgsql security definer set search_path='' as $$
declare result public.stream_viewer_sessions;
begin if presence_action not in('heartbeat','leave') then raise exception using errcode='22023',message='Invalid presence action'; end if;
 update public.stream_viewer_sessions set last_heartbeat_at=now(),left_at=case when presence_action='leave' then now() else left_at end,watch_seconds=greatest(watch_seconds,extract(epoch from(now()-joined_at))::integer) where id=target_session_id and profile_id=auth.uid() returning * into result;
 if not found then raise exception using errcode='42501',message='Viewer session denied'; end if; return result; end;$$;

create function public.add_stream_interaction(target_stream_id uuid,interaction_action text,interaction_value text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.live_streams; member public.memberships; created_id text;
begin if not public.can_access_stream(target_stream_id) then raise exception using errcode='42501',message='Stream access denied'; end if; select * into s from public.live_streams where id=target_stream_id; select * into member from public.memberships where organization_id=s.organization_id and profile_id=auth.uid() and status='active';
 if interaction_action='react' then insert into public.stream_reactions(organization_id,stream_id,profile_id,reaction) values(s.organization_id,s.id,auth.uid(),interaction_value) returning id::text into created_id;
 elsif interaction_action='chat' then if not found then raise exception using errcode='42501',message='Active membership required for chat'; end if; insert into public.stream_messages(organization_id,stream_id,membership_id,body) values(s.organization_id,s.id,member.id,trim(interaction_value)) returning id::text into created_id;
 elsif interaction_action='follow_up' then insert into public.live_follow_ups(organization_id,stream_id,profile_id,branch_id,type) values(s.organization_id,s.id,auth.uid(),member.branch_id,interaction_value::public.live_follow_up_type) returning id::text into created_id;
 else raise exception using errcode='22023',message='Invalid interaction'; end if; return jsonb_build_object('id',created_id,'accepted',true); end;$$;

revoke all on function public.can_access_stream(uuid),public.begin_stream_session(uuid),public.update_stream_presence(uuid,text),public.add_stream_interaction(uuid,text,text) from public;
grant execute on function public.can_access_stream(uuid),public.begin_stream_session(uuid),public.update_stream_presence(uuid,text),public.add_stream_interaction(uuid,text,text) to authenticated;
