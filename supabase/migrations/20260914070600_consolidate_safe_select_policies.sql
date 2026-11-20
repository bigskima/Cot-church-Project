-- Reduce overlapping permissive SELECT policies without changing effective access.
-- Manager ALL policies are split into write-only policies, while their former
-- read privilege is OR-ed into the existing read policy. Public read policies
-- remain public; permission helpers evaluate false for unauthenticated callers.

-- church_story
alter policy church_story_public_read on public.church_story
  using (is_published = true or public.has_permission(organization_id, 'organization.leadership.manage'));
drop policy church_story_manage on public.church_story;
create policy church_story_manage_insert on public.church_story for insert to authenticated
  with check (public.has_permission(organization_id, 'organization.leadership.manage'));
create policy church_story_manage_update on public.church_story for update to authenticated
  using (public.has_permission(organization_id, 'organization.leadership.manage'))
  with check (public.has_permission(organization_id, 'organization.leadership.manage'));
create policy church_story_manage_delete on public.church_story for delete to authenticated
  using (public.has_permission(organization_id, 'organization.leadership.manage'));

-- content comments: public can read visible comments; authors retain access to their own hidden rows.
alter policy comments_read on public.content_comments
  using (
    (not is_hidden and exists (select 1 from public.content_items ci where ci.id = content_comments.content_item_id))
    or (
      author_profile_id = (select auth.uid())
      and exists (select 1 from public.content_items ci where ci.id = content_comments.content_item_id)
    )
  );
drop policy comments_manage on public.content_comments;
create policy comments_manage_insert on public.content_comments for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_comments.content_item_id)
  );
create policy comments_manage_update on public.content_comments for update to authenticated
  using (
    author_profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_comments.content_item_id)
  )
  with check (
    author_profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_comments.content_item_id)
  );
create policy comments_manage_delete on public.content_comments for delete to authenticated
  using (
    author_profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_comments.content_item_id)
  );

-- content reactions are already readable through reactions_read; keep self ownership only for writes.
drop policy reactions_self on public.content_reactions;
create policy reactions_self_insert on public.content_reactions for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_reactions.content_item_id)
  );
create policy reactions_self_update on public.content_reactions for update to authenticated
  using (
    profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_reactions.content_item_id)
  )
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_reactions.content_item_id)
  );
create policy reactions_self_delete on public.content_reactions for delete to authenticated
  using (
    profile_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_reactions.content_item_id)
  );

-- departments
alter policy departments_read on public.departments
  using (
    public.can_read_branch_scoped_resource(organization_id, branch_id)
    or public.has_permission(organization_id, 'units.manage', branch_id)
  );
drop policy departments_manage on public.departments;
create policy departments_manage_insert on public.departments for insert to authenticated
  with check (public.has_permission(organization_id, 'units.manage', branch_id));
create policy departments_manage_update on public.departments for update to authenticated
  using (public.has_permission(organization_id, 'units.manage', branch_id))
  with check (public.has_permission(organization_id, 'units.manage', branch_id));
create policy departments_manage_delete on public.departments for delete to authenticated
  using (public.has_permission(organization_id, 'units.manage', branch_id));

-- devotionals
alter policy devotionals_read_published on public.devotionals
  using (status = 'published' or public.has_permission(organization_id, 'devotionals.manage', expression_id));
drop policy devotionals_manage_authorized on public.devotionals;
create policy devotionals_manage_insert on public.devotionals for insert to authenticated
  with check (public.has_permission(organization_id, 'devotionals.manage', expression_id));
create policy devotionals_manage_update on public.devotionals for update to authenticated
  using (public.has_permission(organization_id, 'devotionals.manage', expression_id))
  with check (public.has_permission(organization_id, 'devotionals.manage', expression_id));
create policy devotionals_manage_delete on public.devotionals for delete to authenticated
  using (public.has_permission(organization_id, 'devotionals.manage', expression_id));

-- event occurrences
alter policy occurrences_member_read on public.event_occurrences
  using (
    exists (
      select 1 from public.events event
      where event.id = event_occurrences.event_id
        and event.organization_id = event_occurrences.organization_id
    )
    or public.has_permission(organization_id, 'events.update')
  );
drop policy occurrences_admin_write on public.event_occurrences;
create policy occurrences_admin_insert on public.event_occurrences for insert to authenticated
  with check (public.has_permission(organization_id, 'events.update'));
create policy occurrences_admin_update on public.event_occurrences for update to authenticated
  using (public.has_permission(organization_id, 'events.update'))
  with check (public.has_permission(organization_id, 'events.update'));
create policy occurrences_admin_delete on public.event_occurrences for delete to authenticated
  using (public.has_permission(organization_id, 'events.update'));

-- Expression memberships
alter policy expression_memberships_self_read on public.expression_memberships
  using (
    profile_id = (select auth.uid())
    or public.has_permission(organization_id, 'members.update', branch_id)
  );
drop policy expression_memberships_scoped_manage on public.expression_memberships;
create policy expression_memberships_manage_insert on public.expression_memberships for insert to authenticated
  with check (public.has_permission(organization_id, 'members.update', branch_id));
create policy expression_memberships_manage_update on public.expression_memberships for update to authenticated
  using (public.has_permission(organization_id, 'members.update', branch_id))
  with check (public.has_permission(organization_id, 'members.update', branch_id));
create policy expression_memberships_manage_delete on public.expression_memberships for delete to authenticated
  using (public.has_permission(organization_id, 'members.update', branch_id));

-- Feed ranking settings
alter policy feed_ranking_settings_read on public.feed_ranking_settings
  using (
    branch_id is null
    or public.is_expression_member(organization_id, branch_id)
    or public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
  );
drop policy feed_ranking_settings_manage on public.feed_ranking_settings;
create policy feed_ranking_settings_manage_insert on public.feed_ranking_settings for insert to authenticated
  with check (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
  );
create policy feed_ranking_settings_manage_update on public.feed_ranking_settings for update to authenticated
  using (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
  )
  with check (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
  );
create policy feed_ranking_settings_manage_delete on public.feed_ranking_settings for delete to authenticated
  using (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
  );

-- Giving configuration
alter policy giving_campaigns_scoped_read on public.giving_campaigns
  using (
    (status in ('active', 'completed') and public.can_read_giving_scope(organization_id, branch_id))
    or public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  );
drop policy giving_campaigns_manage on public.giving_campaigns;
create policy giving_campaigns_manage_insert on public.giving_campaigns for insert to authenticated
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy giving_campaigns_manage_update on public.giving_campaigns for update to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy giving_campaigns_manage_delete on public.giving_campaigns for delete to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

alter policy giving_purposes_authenticated_scoped_read on public.giving_purposes
  using (
    (status = 'active' and public.can_read_giving_scope(organization_id, branch_id))
    or public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  );
drop policy giving_purposes_manage on public.giving_purposes;
create policy giving_purposes_manage_insert on public.giving_purposes for insert to authenticated
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy giving_purposes_manage_update on public.giving_purposes for update to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy giving_purposes_manage_delete on public.giving_purposes for delete to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

alter policy giving_settings_authenticated_scoped_read on public.giving_settings
  using (
    public.can_read_giving_scope(organization_id, branch_id)
    or public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  );
drop policy giving_settings_manage on public.giving_settings;
create policy giving_settings_manage_insert on public.giving_settings for insert to authenticated
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy giving_settings_manage_update on public.giving_settings for update to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy giving_settings_manage_delete on public.giving_settings for delete to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

-- Group memberships have two SELECT audiences; combine them exactly.
drop policy group_memberships_manage on public.group_memberships;
alter policy group_memberships_self on public.group_memberships
  using (
    exists (
      select 1 from public.memberships m
      where m.id = group_memberships.membership_id
        and m.profile_id = (select auth.uid())
    )
    or private.can_manage_group_requests(group_id)
  );

-- groups_discover already includes managers; make the manager policy write-only.
drop policy groups_manage on public.groups;
create policy groups_manage_insert on public.groups for insert to authenticated
  with check (public.has_permission(organization_id, 'groups.manage', branch_id));
create policy groups_manage_update on public.groups for update to authenticated
  using (public.has_permission(organization_id, 'groups.manage', branch_id))
  with check (public.has_permission(organization_id, 'groups.manage', branch_id));
create policy groups_manage_delete on public.groups for delete to authenticated
  using (public.has_permission(organization_id, 'groups.manage', branch_id));

-- Leadership directory
alter policy leadership_profiles_public_read on public.leadership_profiles
  using (
    is_active = true
    or public.has_permission(organization_id, 'organization.leadership.manage')
    or (expression_id is not null and public.has_permission(organization_id, 'expression.leadership.manage', expression_id))
  );
drop policy leadership_profiles_scoped_manage on public.leadership_profiles;
create policy leadership_profiles_manage_insert on public.leadership_profiles for insert to authenticated
  with check (
    public.has_permission(organization_id, 'organization.leadership.manage')
    or (expression_id is not null and public.has_permission(organization_id, 'expression.leadership.manage', expression_id))
  );
create policy leadership_profiles_manage_update on public.leadership_profiles for update to authenticated
  using (
    public.has_permission(organization_id, 'organization.leadership.manage')
    or (expression_id is not null and public.has_permission(organization_id, 'expression.leadership.manage', expression_id))
  )
  with check (
    public.has_permission(organization_id, 'organization.leadership.manage')
    or (expression_id is not null and public.has_permission(organization_id, 'expression.leadership.manage', expression_id))
  );
create policy leadership_profiles_manage_delete on public.leadership_profiles for delete to authenticated
  using (
    public.has_permission(organization_id, 'organization.leadership.manage')
    or (expression_id is not null and public.has_permission(organization_id, 'expression.leadership.manage', expression_id))
  );

-- Bank accounts
alter policy bank_accounts_authenticated_scoped_read on public.organization_bank_accounts
  using (
    (is_public = true and is_active = true and public.can_read_giving_scope(organization_id, branch_id))
    or public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  );
drop policy bank_accounts_manage on public.organization_bank_accounts;
create policy bank_accounts_manage_insert on public.organization_bank_accounts for insert to authenticated
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy bank_accounts_manage_update on public.organization_bank_accounts for update to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));
create policy bank_accounts_manage_delete on public.organization_bank_accounts for delete to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

-- Sermon series read policy already includes managers/publishers.
drop policy sermon_series_admin_manage on public.sermon_series;
create policy sermon_series_manage_insert on public.sermon_series for insert to authenticated
  with check (public.has_permission(organization_id, 'sermons.manage', expression_id));
create policy sermon_series_manage_update on public.sermon_series for update to authenticated
  using (public.has_permission(organization_id, 'sermons.manage', expression_id))
  with check (public.has_permission(organization_id, 'sermons.manage', expression_id));
create policy sermon_series_manage_delete on public.sermon_series for delete to authenticated
  using (public.has_permission(organization_id, 'sermons.manage', expression_id));

-- Sermons: published readers plus draft access for authorized publishers/managers.
alter policy sermons_read_published on public.sermons
  using (
    (
      status = 'published'
      and (
        visibility = 'public'::public.content_visibility
        or (visibility = 'organization'::public.content_visibility and public.is_organization_member(organization_id))
        or (visibility = 'branch'::public.content_visibility and public.is_expression_member(organization_id, expression_id))
      )
    )
    or public.has_permission(organization_id, 'sermons.manage', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  );
drop policy sermons_manage_authorized on public.sermons;
create policy sermons_manage_insert on public.sermons for insert to authenticated
  with check (
    public.has_permission(organization_id, 'sermons.manage', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  );
create policy sermons_manage_update on public.sermons for update to authenticated
  using (
    public.has_permission(organization_id, 'sermons.manage', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  )
  with check (
    public.has_permission(organization_id, 'sermons.manage', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  );
create policy sermons_manage_delete on public.sermons for delete to authenticated
  using (
    public.has_permission(organization_id, 'sermons.manage', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  );

-- Video categories
alter policy video_category_options_read on public.video_category_options
  using (
    exists (
      select 1 from public.organizations o
      where o.id = video_category_options.organization_id and o.status = 'active'::public.organization_status
    )
    or public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'organization.leadership.manage', null::uuid)
  );
drop policy video_category_options_manage on public.video_category_options;
create policy video_category_options_manage_insert on public.video_category_options for insert to authenticated
  with check (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'organization.leadership.manage', null::uuid)
  );
create policy video_category_options_manage_update on public.video_category_options for update to authenticated
  using (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'organization.leadership.manage', null::uuid)
  )
  with check (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'organization.leadership.manage', null::uuid)
  );
create policy video_category_options_manage_delete on public.video_category_options for delete to authenticated
  using (
    public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'organization.leadership.manage', null::uuid)
  );

-- Volunteer opportunities
alter policy volunteer_opportunities_read on public.volunteer_opportunities
  using (
    public.can_read_branch_scoped_resource(organization_id, branch_id)
    or public.has_permission(organization_id, 'volunteers.manage', branch_id)
  );
drop policy volunteer_opportunities_manage on public.volunteer_opportunities;
create policy volunteer_opportunities_manage_insert on public.volunteer_opportunities for insert to authenticated
  with check (public.has_permission(organization_id, 'volunteers.manage', branch_id));
create policy volunteer_opportunities_manage_update on public.volunteer_opportunities for update to authenticated
  using (public.has_permission(organization_id, 'volunteers.manage', branch_id))
  with check (public.has_permission(organization_id, 'volunteers.manage', branch_id));
create policy volunteer_opportunities_manage_delete on public.volunteer_opportunities for delete to authenticated
  using (public.has_permission(organization_id, 'volunteers.manage', branch_id));
