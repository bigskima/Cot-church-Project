-- Cache auth.uid() once per statement in legacy RLS policies.
-- This preserves every existing authorization predicate while avoiding a
-- per-row auth helper call, matching Supabase's current RLS guidance.

alter policy ai_runs_self on public.ai_generation_runs
  using (profile_id = (select auth.uid()));

alter policy idempotency_actor_read on public.api_idempotency_keys
  using (actor_profile_id = (select auth.uid()));

alter policy attendance_self_read on public.attendance_records
  using (exists (
    select 1 from public.memberships m
    where m.id = attendance_records.membership_id
      and m.profile_id = (select auth.uid())
  ));

alter policy chat_media_uploads_participant_read on public.chat_media_uploads
  using (
    uploader_profile_id = (select auth.uid())
    or (conversation_id is not null and public.can_read_direct_conversation(conversation_id))
    or (
      group_id is not null
      and public.can_read_group_chat(group_id)
      and (section_id is null or public.can_read_group_chat_section(section_id))
    )
  );

alter policy content_items_read on public.content_items
  using (
    (
      status = 'published'::public.publication_status
      and (
        visibility = 'public'::public.content_visibility
        or (visibility = 'organization'::public.content_visibility and public.is_organization_member(organization_id))
        or (visibility = 'branch'::public.content_visibility and public.is_expression_member(organization_id, expression_id))
        or (visibility = 'group'::public.content_visibility and public.can_read_social_scope(organization_id, visibility, expression_id, group_id))
      )
    )
    or author_profile_id = (select auth.uid())
    or public.has_permission(organization_id, 'posts.publish', expression_id)
    or public.has_permission(organization_id, 'reels.publish', expression_id)
    or public.has_permission(organization_id, 'videos.publish', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  );

alter policy moderation_reports_reporter_insert on public.content_moderation_reports
  with check (
    reporter_profile_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and action_taken is null
  );

alter policy moderation_reports_reporter_read on public.content_moderation_reports
  using (reporter_profile_id = (select auth.uid()));

alter policy participants_conversation_read on public.conversation_participants
  using (exists (
    select 1
    from public.conversation_participants self
    join public.memberships m on m.id = self.membership_id
    where self.conversation_id = conversation_participants.conversation_id
      and m.profile_id = (select auth.uid())
      and self.left_at is null
  ));

alter policy conversations_participant_read on public.conversations
  using (exists (
    select 1
    from public.conversation_participants cp
    join public.memberships m on m.id = cp.membership_id
    where cp.conversation_id = conversations.id
      and m.profile_id = (select auth.uid())
      and cp.left_at is null
  ));

alter policy direct_conversations_participant_read on public.direct_conversations
  using ((select auth.uid()) = participant_low or (select auth.uid()) = participant_high);

alter policy donations_donor_read on public.donations
  using (donor_profile_id = (select auth.uid()));

alter policy registrations_self_read on public.event_registrations
  using (exists (
    select 1 from public.memberships m
    where m.id = event_registrations.membership_id
      and m.profile_id = (select auth.uid())
  ));

alter policy events_admin_insert on public.events
  with check (
    created_by = (select auth.uid())
    and public.has_permission(organization_id, 'events.create', branch_id)
  );

alter policy expression_creator_authorizations_self_read on public.expression_creator_authorizations
  using (profile_id = (select auth.uid()));

alter policy expression_memberships_self_read on public.expression_memberships
  using (profile_id = (select auth.uid()));

alter policy follows_self on public.follows
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

alter policy governance_invitations_target_read on public.governance_invitations
  using (target_profile_id = (select auth.uid()));

alter policy group_memberships_self on public.group_memberships
  using (exists (
    select 1 from public.memberships m
    where m.id = group_memberships.membership_id
      and m.profile_id = (select auth.uid())
  ));

alter policy groups_discover on public.groups
  using (
    (visibility = 'members' and public.can_read_branch_scoped_resource(organization_id, branch_id))
    or (
      visibility = 'private'
      and exists (
        select 1
        from public.group_memberships gm
        join public.memberships m on m.id = gm.membership_id
        where gm.group_id = groups.id
          and gm.status = 'active'::public.group_membership_status
          and m.profile_id = (select auth.uid())
      )
    )
    or public.has_permission(organization_id, 'groups.manage', branch_id)
  );

alter policy live_grants_self on public.live_access_grants
  using (profile_id = (select auth.uid()));

alter policy follow_ups_self_read on public.live_follow_ups
  using (profile_id = (select auth.uid()));

alter policy media_assets_read on public.media_assets
  using (
    created_by = (select auth.uid())
    or public.has_permission(organization_id, 'media.manage', expression_id)
    or exists (
      select 1
      from public.content_items ci
      where ci.organization_id = media_assets.organization_id
        and ci.status = 'published'::public.publication_status
        and (
          ci.id in (select r.id from public.reels r where r.media_asset_id = media_assets.id)
          or ci.id in (select v.id from public.videos v where v.media_asset_id = media_assets.id)
          or ci.id in (
            select s.id from public.sermons s
            where s.audio_asset_id = media_assets.id or s.video_asset_id = media_assets.id
          )
        )
    )
  );

alter policy memberships_read_self on public.memberships
  using (profile_id = (select auth.uid()));

alter policy messages_participant_read on public.messages
  using (exists (
    select 1
    from public.conversation_participants cp
    join public.memberships m on m.id = cp.membership_id
    where cp.conversation_id = messages.conversation_id
      and m.profile_id = (select auth.uid())
      and cp.left_at is null
  ));

alter policy notification_preferences_self on public.notification_preferences
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and public.is_organization_member(organization_id)
  );

alter policy notifications_self_read on public.notifications
  using (recipient_profile_id = (select auth.uid()));

alter policy notifications_self_update on public.notifications
  using (recipient_profile_id = (select auth.uid()))
  with check (recipient_profile_id = (select auth.uid()));

alter policy attempts_donor_read on public.payment_attempts
  using (exists (
    select 1 from public.donations d
    where d.id = payment_attempts.donation_id
      and d.donor_profile_id = (select auth.uid())
  ));

alter policy platform_role_assignments_read_self_or_authorized on public.platform_role_assignments
  using (
    profile_id = (select auth.uid())
    or public.has_platform_permission('platform.roles.read')
  );

alter policy platform_user_restrictions_self_read on public.platform_user_restrictions
  using (profile_id = (select auth.uid()));

alter policy prayer_request_recipients_self_read on public.prayer_request_recipients
  using (recipient_profile_id = (select auth.uid()));

alter policy prayer_routes_manager_read on public.prayer_request_routes
  using (exists (
    select 1
    from public.memberships m
    join public.role_assignments ra
      on ra.membership_id = m.id
     and ra.organization_id = m.organization_id
    join public.role_permissions rp
      on rp.role_id = ra.role_id
     and rp.permission_code = 'roles.assign'
    where m.profile_id = (select auth.uid())
      and m.organization_id = prayer_request_routes.organization_id
      and m.status = 'active'::public.membership_status
      and (ra.expires_at is null or ra.expires_at > now())
      and (
        (prayer_request_routes.branch_id is null and ra.branch_id is null)
        or ra.branch_id = prayer_request_routes.branch_id
      )
  ));

alter policy prayer_owner_all on public.prayer_requests
  using (
    submitted_by_profile_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.id = prayer_requests.membership_id
        and m.profile_id = (select auth.uid())
    )
  )
  with check (
    submitted_by_profile_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.id = prayer_requests.membership_id
        and m.profile_id = (select auth.uid())
    )
  );

alter policy posting_controls_self_read on public.profile_posting_controls
  using (profile_id = (select auth.uid()));

alter policy profiles_read_self on public.profiles
  using (id = (select auth.uid()));

alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy push_devices_self on public.push_devices
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

alter policy receipts_owner_read on public.receipts
  using (issued_to_profile_id = (select auth.uid()));

alter policy refunds_donor_read on public.refunds
  using (exists (
    select 1 from public.donations d
    where d.id = refunds.donation_id
      and d.donor_profile_id = (select auth.uid())
  ));

alter policy role_assignments_read_self on public.role_assignments
  using (exists (
    select 1 from public.memberships m
    where m.id = role_assignments.membership_id
      and m.profile_id = (select auth.uid())
  ));

alter policy stream_sessions_self on public.stream_viewer_sessions
  using (profile_id = (select auth.uid()));

alter policy volunteer_applications_self on public.volunteer_applications
  using (exists (
    select 1 from public.memberships m
    where m.id = volunteer_applications.membership_id
      and m.profile_id = (select auth.uid())
  ));

alter policy volunteer_schedules_self on public.volunteer_schedules
  using (exists (
    select 1 from public.memberships m
    where m.id = volunteer_schedules.membership_id
      and m.profile_id = (select auth.uid())
  ));
