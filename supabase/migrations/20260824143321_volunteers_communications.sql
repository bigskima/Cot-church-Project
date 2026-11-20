-- Volunteer operations, announcements, notification preferences, devices, and durable delivery outbox.

create type public.volunteer_application_status as enum ('applied', 'approved', 'declined', 'withdrawn');
create type public.volunteer_schedule_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.announcement_status as enum ('draft', 'scheduled', 'published', 'cancelled', 'archived');
create type public.delivery_channel as enum ('in_app', 'email', 'sms', 'push');
create type public.outbox_status as enum ('pending', 'processing', 'delivered', 'failed', 'dead_letter');

insert into public.permissions (code, name, description, category) values
 ('volunteers.read', 'View volunteers', 'View volunteer opportunities and schedules.', 'volunteers'),
 ('volunteers.manage', 'Manage volunteers', 'Manage opportunities, applications, and schedules.', 'volunteers'),
 ('announcements.read', 'View announcements', 'View member announcements.', 'communications'),
 ('announcements.manage', 'Manage announcements', 'Draft, schedule, publish, and archive announcements.', 'communications'),
 ('notifications.manage', 'Manage notification delivery', 'Inspect and operate notification delivery.', 'communications')
on conflict (code) do update set name=excluded.name, description=excluded.description, category=excluded.category, is_active=true;

create table public.volunteer_opportunities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 branch_id uuid, ministry_id uuid, title text not null check (char_length(trim(title)) between 1 and 180), description text not null default '',
 starts_at timestamptz, ends_at timestamptz, capacity integer check (capacity is null or capacity > 0), is_active boolean not null default true,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id, organization_id), foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict,
 foreign key (ministry_id, organization_id) references public.ministries(id, organization_id) on delete restrict, check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create table public.volunteer_applications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 opportunity_id uuid not null, membership_id uuid not null, status public.volunteer_application_status not null default 'applied', note text not null default '',
 applied_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
 foreign key (opportunity_id, organization_id) references public.volunteer_opportunities(id, organization_id) on delete cascade,
 foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade, unique (opportunity_id, membership_id)
);
create table public.volunteer_schedules (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 opportunity_id uuid not null, membership_id uuid not null, starts_at timestamptz not null, ends_at timestamptz not null,
 status public.volunteer_schedule_status not null default 'scheduled', notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (opportunity_id, organization_id) references public.volunteer_opportunities(id, organization_id) on delete cascade,
 foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade,
 unique (opportunity_id, membership_id, starts_at), check (ends_at > starts_at)
);

create table public.announcements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 branch_id uuid, title text not null check (char_length(trim(title)) between 1 and 180), body text not null check (char_length(trim(body)) between 1 and 20000),
 status public.announcement_status not null default 'draft', audience jsonb not null default '{"type":"organization"}'::jsonb check (jsonb_typeof(audience)='object'),
 channels public.delivery_channel[] not null default array['in_app']::public.delivery_channel[], scheduled_for timestamptz, published_at timestamptz,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id, organization_id), foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict
);
create table public.notification_preferences (
 profile_id uuid not null references public.profiles(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade,
 email_enabled boolean not null default true, sms_enabled boolean not null default true, push_enabled boolean not null default true,
 quiet_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(quiet_hours)='object'), updated_at timestamptz not null default now(), primary key (profile_id, organization_id)
);
create table public.push_devices (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 expo_push_token text not null unique, platform text not null check (platform in ('ios','android','web')), device_name text,
 is_active boolean not null default true, last_seen_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.notification_outbox (
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
 announcement_id uuid, recipient_profile_id uuid references public.profiles(id) on delete cascade, channel public.delivery_channel not null,
 deduplication_key text not null unique, payload jsonb not null check (jsonb_typeof(payload)='object'), status public.outbox_status not null default 'pending',
 attempts integer not null default 0, available_at timestamptz not null default now(), locked_at timestamptz, delivered_at timestamptz,
 last_error text, created_at timestamptz not null default now(), foreign key (announcement_id, organization_id) references public.announcements(id, organization_id) on delete cascade
);
create index volunteer_opportunities_discovery_idx on public.volunteer_opportunities (organization_id, branch_id, is_active);
create index volunteer_schedules_member_idx on public.volunteer_schedules (membership_id, starts_at);
create index announcements_feed_idx on public.announcements (organization_id, branch_id, published_at desc);
create index notification_outbox_dispatch_idx on public.notification_outbox (status, available_at) where status in ('pending','failed');
create trigger volunteer_opportunities_updated before update on public.volunteer_opportunities for each row execute function public.set_updated_at();
create trigger volunteer_schedules_updated before update on public.volunteer_schedules for each row execute function public.set_updated_at();
create trigger announcements_updated before update on public.announcements for each row execute function public.set_updated_at();
create trigger notification_preferences_updated before update on public.notification_preferences for each row execute function public.set_updated_at();

alter table public.volunteer_opportunities enable row level security; alter table public.volunteer_applications enable row level security;
alter table public.volunteer_schedules enable row level security; alter table public.announcements enable row level security;
alter table public.notification_preferences enable row level security; alter table public.push_devices enable row level security; alter table public.notification_outbox enable row level security;
create policy volunteer_opportunities_read on public.volunteer_opportunities for select to authenticated using (public.is_organization_member(organization_id));
create policy volunteer_opportunities_manage on public.volunteer_opportunities for all to authenticated using (public.has_permission(organization_id,'volunteers.manage',branch_id)) with check (public.has_permission(organization_id,'volunteers.manage',branch_id));
create policy volunteer_applications_self on public.volunteer_applications for select to authenticated using (exists(select 1 from public.memberships m where m.id=membership_id and m.profile_id=auth.uid()));
create policy volunteer_applications_manage on public.volunteer_applications for select to authenticated using (public.has_permission(organization_id,'volunteers.manage'));
create policy volunteer_schedules_self on public.volunteer_schedules for select to authenticated using (exists(select 1 from public.memberships m where m.id=membership_id and m.profile_id=auth.uid()));
create policy volunteer_schedules_manage on public.volunteer_schedules for all to authenticated using (public.has_permission(organization_id,'volunteers.manage')) with check (public.has_permission(organization_id,'volunteers.manage'));
create policy announcements_feed on public.announcements for select to authenticated using (public.is_organization_member(organization_id) and status='published');
create policy announcements_manage on public.announcements for all to authenticated using (public.has_permission(organization_id,'announcements.manage',branch_id)) with check (public.has_permission(organization_id,'announcements.manage',branch_id));
create policy notification_preferences_self on public.notification_preferences for all to authenticated using (profile_id=auth.uid()) with check (profile_id=auth.uid() and public.is_organization_member(organization_id));
create policy push_devices_self on public.push_devices for all to authenticated using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy outbox_admin_read on public.notification_outbox for select to authenticated using (public.has_permission(organization_id,'notifications.manage'));

create function public.apply_for_volunteer_opportunity(target_opportunity_id uuid, application_note text default '') returns public.volunteer_applications
language plpgsql security definer set search_path='' as $$ declare opportunity public.volunteer_opportunities; member public.memberships; result public.volunteer_applications; approved_count integer; begin
 select * into opportunity from public.volunteer_opportunities where id=target_opportunity_id and is_active for update; if not found then raise exception using errcode='P0002',message='Opportunity not found'; end if;
 select * into member from public.memberships where organization_id=opportunity.organization_id and profile_id=auth.uid() and status='active'; if not found then raise exception using errcode='42501',message='Active membership required'; end if;
 select count(*) into approved_count from public.volunteer_applications where opportunity_id=target_opportunity_id and status='approved'; if opportunity.capacity is not null and approved_count>=opportunity.capacity then raise exception using errcode='23514',message='Opportunity is full'; end if;
 insert into public.volunteer_applications(organization_id,opportunity_id,membership_id,note) values(opportunity.organization_id,target_opportunity_id,member.id,left(coalesce(application_note,''),1000)) on conflict(opportunity_id,membership_id) do update set status='applied',note=excluded.note,applied_at=now(),reviewed_at=null,reviewed_by=null returning * into result; return result; end; $$;

create function public.publish_announcement(target_announcement_id uuid) returns public.announcements language plpgsql security definer set search_path='' as $$ declare result public.announcements; selected public.announcements; begin
 select * into selected from public.announcements where id=target_announcement_id for update; if not found then raise exception using errcode='P0002',message='Announcement not found'; end if;
 if not public.has_permission(selected.organization_id,'announcements.manage',selected.branch_id) then raise exception using errcode='42501',message='Permission denied'; end if;
 update public.announcements set status='published',published_at=now() where id=target_announcement_id returning * into result;
 insert into public.notification_outbox(organization_id,announcement_id,channel,deduplication_key,payload)
 select result.organization_id,result.id,channel,'announcement:'||result.id||':'||channel::text,jsonb_build_object('announcementId',result.id,'audience',result.audience)
 from unnest(result.channels) channel on conflict(deduplication_key) do nothing; return result; end; $$;

revoke all on function public.apply_for_volunteer_opportunity(uuid,text) from public; revoke all on function public.publish_announcement(uuid) from public;
grant execute on function public.apply_for_volunteer_opportunity(uuid,text) to authenticated; grant execute on function public.publish_announcement(uuid) to authenticated;
create trigger audit_volunteer_opportunities after insert or update or delete on public.volunteer_opportunities for each row execute function public.audit_row_change();
create trigger audit_volunteer_applications after insert or update or delete on public.volunteer_applications for each row execute function public.audit_row_change();
create trigger audit_volunteer_schedules after insert or update or delete on public.volunteer_schedules for each row execute function public.audit_row_change();
create trigger audit_announcements after insert or update or delete on public.announcements for each row execute function public.audit_row_change();
