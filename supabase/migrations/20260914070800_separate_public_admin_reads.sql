-- Two public catalog policies also need authenticated platform-admin visibility.
-- Keep anonymous reads on an anon-only policy so authenticated-only platform
-- helpers are never evaluated for anonymous requests, while avoiding overlapping
-- permissive policies for authenticated users.

alter policy feed_ranking_settings_read on public.feed_ranking_settings
  to anon
  using (branch_id is null or public.is_expression_member(organization_id, branch_id));

create policy feed_ranking_settings_authenticated_read
  on public.feed_ranking_settings
  for select
  to authenticated
  using (
    branch_id is null
    or public.is_expression_member(organization_id, branch_id)
    or public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
  );

alter policy video_category_options_read on public.video_category_options
  to anon
  using (
    exists (
      select 1 from public.organizations o
      where o.id = video_category_options.organization_id
        and o.status = 'active'::public.organization_status
    )
  );

create policy video_category_options_authenticated_read
  on public.video_category_options
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organizations o
      where o.id = video_category_options.organization_id
        and o.status = 'active'::public.organization_status
    )
    or public.has_platform_permission('platform.features.manage')
    or public.has_permission(organization_id, 'organization.leadership.manage', null::uuid)
  );
