-- Finish consolidating overlapping permissive policies while preserving the
-- exact union of anonymous, member, owner and manager access.

-- Announcements: readers plus managers use one authenticated SELECT predicate.
alter policy announcements_feed on public.announcements
  using (
    (status = 'published'::public.announcement_status and public.can_read_branch_scoped_resource(organization_id, branch_id))
    or public.has_permission(organization_id, 'announcements.manage', branch_id)
  );
drop policy announcements_manage on public.announcements;
create policy announcements_manage_insert on public.announcements for insert to authenticated
  with check (public.has_permission(organization_id, 'announcements.manage', branch_id));
create policy announcements_manage_update on public.announcements for update to authenticated
  using (public.has_permission(organization_id, 'announcements.manage', branch_id))
  with check (public.has_permission(organization_id, 'announcements.manage', branch_id));
create policy announcements_manage_delete on public.announcements for delete to authenticated
  using (public.has_permission(organization_id, 'announcements.manage', branch_id));

-- Branch discovery: anonymous users keep active discovery; signed-in users get
-- the same public discovery plus organization-member visibility.
alter policy branches_public_discovery on public.branches
  to anon
  using (
    is_active
    and exists (
      select 1 from public.organizations o
      where o.id = branches.organization_id and o.status = 'active'::public.organization_status
    )
  );
alter policy branches_read_for_members on public.branches
  using (
    public.is_organization_member(organization_id)
    or (
      is_active
      and exists (
        select 1 from public.organizations o
        where o.id = branches.organization_id and o.status = 'active'::public.organization_status
      )
    )
  );

-- Events: one anonymous public policy and one authenticated union policy.
alter policy events_public_read on public.events
  to anon
  using (status = 'published'::public.event_status and visibility = 'public');

drop policy events_member_read on public.events;
drop policy events_admin_read on public.events;
create policy events_authenticated_read on public.events for select to authenticated
  using (
    (status = 'published'::public.event_status and visibility = 'public')
    or (
      status <> 'draft'::public.event_status
      and visibility = 'members'
      and public.is_organization_member(organization_id)
      and (branch_id is null or public.is_expression_member(organization_id, branch_id))
    )
    or public.has_permission(organization_id, 'events.read', branch_id)
  );

-- Live streams: preserve public discovery, scoped member reads and manager draft access.
alter policy streams_public_read on public.live_streams
  to anon
  using (
    visibility = 'public'::public.content_visibility
    and status = any (array[
      'scheduled'::public.stream_status,
      'provisioning'::public.stream_status,
      'ready'::public.stream_status,
      'live'::public.stream_status,
      'ended'::public.stream_status,
      'processing'::public.stream_status,
      'replay_ready'::public.stream_status
    ])
  );

drop policy streams_scoped_member_read on public.live_streams;
drop policy streams_manage on public.live_streams;
create policy streams_authenticated_read on public.live_streams for select to authenticated
  using (
    (
      visibility = 'public'::public.content_visibility
      and status = any (array[
        'scheduled'::public.stream_status,
        'provisioning'::public.stream_status,
        'ready'::public.stream_status,
        'live'::public.stream_status,
        'ended'::public.stream_status,
        'processing'::public.stream_status,
        'replay_ready'::public.stream_status
      ])
    )
    or (
      status <> 'draft'::public.stream_status
      and (
        visibility = 'public'::public.content_visibility
        or (visibility = 'organization'::public.content_visibility and public.is_organization_member(organization_id))
        or (visibility = 'branch'::public.content_visibility and public.is_expression_member(organization_id, branch_id))
        or (visibility = 'group'::public.content_visibility and public.can_read_social_scope(organization_id, visibility, branch_id, group_id))
      )
    )
    or public.has_permission(organization_id, 'streams.manage', branch_id)
  );
create policy streams_manage_insert on public.live_streams for insert to authenticated
  with check (public.has_permission(organization_id, 'streams.manage', branch_id));
create policy streams_manage_update on public.live_streams for update to authenticated
  using (public.has_permission(organization_id, 'streams.manage', branch_id))
  with check (public.has_permission(organization_id, 'streams.manage', branch_id));
create policy streams_manage_delete on public.live_streams for delete to authenticated
  using (public.has_permission(organization_id, 'streams.manage', branch_id));

-- Organization discovery.
alter policy organizations_public_discovery on public.organizations
  to anon
  using (status = 'active'::public.organization_status);
alter policy organizations_read_for_members on public.organizations
  using (status = 'active'::public.organization_status or public.is_organization_member(id));

-- Platform branding: anonymous users see active branding; platform managers keep draft access.
alter policy platform_branding_public_read on public.platform_branding
  to anon
  using (is_active = true);
drop policy platform_branding_manage on public.platform_branding;
create policy platform_branding_authenticated_read on public.platform_branding for select to authenticated
  using (is_active = true or public.has_platform_permission('platform.branding.manage'));
create policy platform_branding_manage_insert on public.platform_branding for insert to authenticated
  with check (public.has_platform_permission('platform.branding.manage'));
create policy platform_branding_manage_update on public.platform_branding for update to authenticated
  using (public.has_platform_permission('platform.branding.manage'))
  with check (public.has_platform_permission('platform.branding.manage'));
create policy platform_branding_manage_delete on public.platform_branding for delete to authenticated
  using (public.has_platform_permission('platform.branding.manage'));

-- Prayer requests: exact union of owner, routed recipient and moderator access.
drop policy prayer_owner_all on public.prayer_requests;
drop policy prayer_recipient_read on public.prayer_requests;
drop policy prayer_moderate_update on public.prayer_requests;
create policy prayer_requests_read on public.prayer_requests for select to authenticated
  using (
    submitted_by_profile_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.id = prayer_requests.membership_id and m.profile_id = (select auth.uid())
    )
    or public.can_receive_prayer_scope(organization_id, branch_id, visibility)
  );
create policy prayer_requests_owner_insert on public.prayer_requests for insert to authenticated
  with check (
    submitted_by_profile_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.id = prayer_requests.membership_id and m.profile_id = (select auth.uid())
    )
  );
create policy prayer_requests_update on public.prayer_requests for update to authenticated
  using (
    submitted_by_profile_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.id = prayer_requests.membership_id and m.profile_id = (select auth.uid())
    )
    or public.can_moderate_prayer_scope(organization_id, branch_id, visibility)
  )
  with check (
    submitted_by_profile_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.id = prayer_requests.membership_id and m.profile_id = (select auth.uid())
    )
    or public.can_moderate_prayer_scope(organization_id, branch_id, visibility)
  );
create policy prayer_requests_owner_delete on public.prayer_requests for delete to authenticated
  using (
    submitted_by_profile_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.id = prayer_requests.membership_id and m.profile_id = (select auth.uid())
    )
  );

-- Social posts: anonymous public reads remain separate; authenticated readers use
-- a single union covering public, scoped and author visibility.
alter policy posts_public_read on public.social_posts
  to anon
  using (status = 'published'::public.post_status and visibility = 'public'::public.content_visibility);
drop policy posts_author_read on public.social_posts;
drop policy posts_scoped_read on public.social_posts;
create policy posts_authenticated_read on public.social_posts for select to authenticated
  using (
    (status = 'published'::public.post_status and visibility = 'public'::public.content_visibility)
    or (status = 'published'::public.post_status and public.can_read_social_scope(organization_id, visibility, branch_id, group_id))
    or exists (
      select 1 from public.content_items ci
      where ci.id = social_posts.id
        and ci.organization_id = social_posts.organization_id
        and ci.author_profile_id = (select auth.uid())
    )
  );
