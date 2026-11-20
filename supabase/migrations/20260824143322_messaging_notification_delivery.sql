-- Conversations, messages, personal notification inbox, and recipient delivery fan-out.

create type public.conversation_type as enum ('direct', 'group', 'ministry', 'support');
create type public.message_status as enum ('sent', 'edited', 'redacted');

insert into public.permissions (code,name,description,category) values
 ('messages.moderate','Moderate messages','Redact abusive or sensitive organization messages.','communications')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

create table public.conversations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 branch_id uuid, type public.conversation_type not null, title text, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete restrict
);
create table public.conversation_participants (
 conversation_id uuid not null, organization_id uuid not null references public.organizations(id) on delete cascade,
 membership_id uuid not null, joined_at timestamptz not null default now(), left_at timestamptz, last_read_at timestamptz,
 primary key(conversation_id,membership_id), foreign key(conversation_id,organization_id) references public.conversations(id,organization_id) on delete cascade,
 foreign key(membership_id,organization_id) references public.memberships(id,organization_id) on delete cascade
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 conversation_id uuid not null, sender_membership_id uuid not null, body text not null check(char_length(trim(body)) between 1 and 10000),
 status public.message_status not null default 'sent', reply_to_id uuid references public.messages(id) on delete set null,
 sent_at timestamptz not null default now(), edited_at timestamptz, redacted_at timestamptz,
 foreign key(conversation_id,organization_id) references public.conversations(id,organization_id) on delete cascade,
 foreign key(sender_membership_id,organization_id) references public.memberships(id,organization_id) on delete restrict
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 recipient_profile_id uuid not null references public.profiles(id) on delete cascade, announcement_id uuid,
 type text not null, title text not null, body text not null, data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'),
 read_at timestamptz, created_at timestamptz not null default now(),
 foreign key(announcement_id,organization_id) references public.announcements(id,organization_id) on delete cascade,
 unique nulls not distinct(announcement_id,recipient_profile_id,type)
);
create table public.notification_deliveries (
 id bigint generated always as identity primary key, outbox_id bigint not null references public.notification_outbox(id) on delete cascade,
 provider text not null, provider_message_id text, status public.outbox_status not null, response_metadata jsonb not null default '{}'::jsonb,
 attempted_at timestamptz not null default now()
);
create index conversations_updated_idx on public.conversations(organization_id,updated_at desc);
create index messages_conversation_idx on public.messages(conversation_id,sent_at desc);
create index notifications_inbox_idx on public.notifications(recipient_profile_id,created_at desc);
create trigger conversations_updated before update on public.conversations for each row execute function public.set_updated_at();

alter table public.conversations enable row level security; alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security; alter table public.notifications enable row level security; alter table public.notification_deliveries enable row level security;
create policy conversations_participant_read on public.conversations for select to authenticated using(exists(select 1 from public.conversation_participants cp join public.memberships m on m.id=cp.membership_id where cp.conversation_id=conversations.id and m.profile_id=auth.uid() and cp.left_at is null));
create policy participants_conversation_read on public.conversation_participants for select to authenticated using(exists(select 1 from public.conversation_participants self join public.memberships m on m.id=self.membership_id where self.conversation_id=conversation_participants.conversation_id and m.profile_id=auth.uid() and self.left_at is null));
create policy messages_participant_read on public.messages for select to authenticated using(exists(select 1 from public.conversation_participants cp join public.memberships m on m.id=cp.membership_id where cp.conversation_id=messages.conversation_id and m.profile_id=auth.uid() and cp.left_at is null));
create policy notifications_self_read on public.notifications for select to authenticated using(recipient_profile_id=auth.uid());
create policy notifications_self_update on public.notifications for update to authenticated using(recipient_profile_id=auth.uid()) with check(recipient_profile_id=auth.uid());
create policy deliveries_admin_read on public.notification_deliveries for select to authenticated using(exists(select 1 from public.notification_outbox o where o.id=outbox_id and public.has_permission(o.organization_id,'notifications.manage')));

create function public.protect_notification_content() returns trigger language plpgsql set search_path='' as $$ begin
 if new.organization_id<>old.organization_id or new.recipient_profile_id<>old.recipient_profile_id or new.announcement_id is distinct from old.announcement_id or new.type<>old.type or new.title<>old.title or new.body<>old.body or new.data<>old.data or new.created_at<>old.created_at then raise exception using errcode='23514',message='Only read state can be changed'; end if; return new; end; $$;
create trigger notifications_protect_content before update on public.notifications for each row execute function public.protect_notification_content();

create function public.create_direct_conversation(target_organization_id uuid,target_membership_ids uuid[]) returns public.conversations
language plpgsql security definer set search_path='' as $$ declare caller_member public.memberships; result public.conversations; normalized uuid[]; begin
 select * into caller_member from public.memberships where organization_id=target_organization_id and profile_id=auth.uid() and status='active'; if not found then raise exception using errcode='42501',message='Active membership required'; end if;
 normalized:=array(select distinct value from unnest(array_append(target_membership_ids,caller_member.id)) value); if array_length(normalized,1) not between 2 and 20 then raise exception using errcode='22023',message='Conversation requires 2-20 participants'; end if;
 if exists(select 1 from unnest(normalized) value left join public.memberships m on m.id=value and m.organization_id=target_organization_id and m.status='active' where m.id is null) then raise exception using errcode='22023',message='Invalid participant'; end if;
 insert into public.conversations(organization_id,type,created_by) values(target_organization_id,case when array_length(normalized,1)=2 then 'direct' else 'group' end,auth.uid()) returning * into result;
 insert into public.conversation_participants(conversation_id,organization_id,membership_id) select result.id,target_organization_id,value from unnest(normalized)value; return result; end; $$;

create function public.send_message(target_conversation_id uuid,message_body text,target_reply_to_id uuid default null) returns public.messages
language plpgsql security definer set search_path='' as $$ declare member public.memberships; conversation public.conversations; result public.messages; begin
 select c.* into conversation from public.conversations c join public.conversation_participants cp on cp.conversation_id=c.id join public.memberships m on m.id=cp.membership_id where c.id=target_conversation_id and m.profile_id=auth.uid() and m.status='active' and cp.left_at is null;
 if not found then raise exception using errcode='42501',message='Conversation access denied'; end if; if char_length(trim(message_body)) not between 1 and 10000 then raise exception using errcode='22023',message='Invalid message'; end if;
 select * into member from public.memberships where organization_id=conversation.organization_id and profile_id=auth.uid();
 if target_reply_to_id is not null and not exists(select 1 from public.messages where id=target_reply_to_id and conversation_id=target_conversation_id) then raise exception using errcode='22023',message='Invalid reply target'; end if;
 insert into public.messages(organization_id,conversation_id,sender_membership_id,body,reply_to_id) values(conversation.organization_id,target_conversation_id,member.id,trim(message_body),target_reply_to_id) returning * into result;
 update public.conversations set updated_at=now() where id=target_conversation_id; return result; end; $$;

create or replace function public.publish_announcement(target_announcement_id uuid) returns public.announcements language plpgsql security definer set search_path='' as $$ declare result public.announcements; selected public.announcements; begin
 select * into selected from public.announcements where id=target_announcement_id for update; if not found then raise exception using errcode='P0002',message='Announcement not found'; end if;
 if not public.has_permission(selected.organization_id,'announcements.manage',selected.branch_id) then raise exception using errcode='42501',message='Permission denied'; end if;
 update public.announcements set status='published',published_at=now() where id=target_announcement_id returning * into result;
 insert into public.notifications(organization_id,recipient_profile_id,announcement_id,type,title,body,data)
 select result.organization_id,m.profile_id,result.id,'announcement',result.title,result.body,jsonb_build_object('announcementId',result.id)
 from public.memberships m where m.organization_id=result.organization_id and m.status='active' and (result.branch_id is null or m.branch_id=result.branch_id)
 on conflict do nothing;
 insert into public.notification_outbox(organization_id,announcement_id,recipient_profile_id,channel,deduplication_key,payload)
 select result.organization_id,result.id,m.profile_id,channel,'announcement:'||result.id||':'||m.profile_id||':'||channel::text,jsonb_build_object('announcementId',result.id,'profileId',m.profile_id)
 from public.memberships m cross join unnest(result.channels) channel left join public.notification_preferences p on p.profile_id=m.profile_id and p.organization_id=result.organization_id
 where m.organization_id=result.organization_id and m.status='active' and (result.branch_id is null or m.branch_id=result.branch_id) and channel<>'in_app'
 and case channel when 'email' then coalesce(p.email_enabled,true) when 'sms' then coalesce(p.sms_enabled,true) when 'push' then coalesce(p.push_enabled,true) else true end
 on conflict(deduplication_key) do nothing; return result; end; $$;

create function public.claim_notification_outbox(batch_size integer default 50) returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$ begin
 update public.notification_outbox set status='dead_letter',locked_at=null where status='failed' and attempts>=8;
 return query with jobs as(select id from public.notification_outbox where status in('pending','failed') and available_at<=now() and attempts<8 order by available_at for update skip locked limit least(greatest(batch_size,1),100))
 update public.notification_outbox o set status='processing',locked_at=now(),attempts=attempts+1 from jobs where o.id=jobs.id returning o.*; end; $$;

revoke all on function public.create_direct_conversation(uuid,uuid[]) from public; revoke all on function public.send_message(uuid,text,uuid) from public; revoke all on function public.claim_notification_outbox(integer) from public;
grant execute on function public.create_direct_conversation(uuid,uuid[]) to authenticated; grant execute on function public.send_message(uuid,text,uuid) to authenticated; grant execute on function public.claim_notification_outbox(integer) to service_role;
create trigger audit_conversations after insert or update or delete on public.conversations for each row execute function public.audit_row_change();
