-- Merge same-role permissive SELECT policies by preserving their exact OR-union.
-- This reduces repeated RLS predicate evaluation for authenticated requests.

alter policy ai_runs_self on public.ai_generation_runs
  using (
    profile_id = (select auth.uid())
    or (organization_id is not null and public.has_permission(organization_id, 'ai.review'))
  );
drop policy ai_runs_review on public.ai_generation_runs;

alter policy attendance_self_read on public.attendance_records
  using (
    exists (
      select 1 from public.memberships m
      where m.id = attendance_records.membership_id
        and m.profile_id = (select auth.uid())
    )
    or public.has_permission(organization_id, 'attendance.read')
  );
drop policy attendance_admin_read on public.attendance_records;

alter policy moderation_reports_reporter_read on public.content_moderation_reports
  using (
    reporter_profile_id = (select auth.uid())
    or public.has_permission(organization_id, 'content.moderate', expression_id)
  );
drop policy moderation_reports_moderator_read on public.content_moderation_reports;

alter policy donations_donor_read on public.donations
  using (
    donor_profile_id = (select auth.uid())
    or public.has_permission(organization_id, 'giving.finance.read', branch_id)
  );
drop policy donations_finance_read on public.donations;

alter policy registrations_self_read on public.event_registrations
  using (
    exists (
      select 1 from public.memberships m
      where m.id = event_registrations.membership_id
        and m.profile_id = (select auth.uid())
    )
    or public.has_permission(organization_id, 'attendance.read')
  );
drop policy registrations_admin_read on public.event_registrations;

alter policy expression_creator_authorizations_self_read on public.expression_creator_authorizations
  using (
    profile_id = (select auth.uid())
    or public.has_platform_permission('platform.expression_creators.manage')
  );
drop policy expression_creator_authorizations_platform_read on public.expression_creator_authorizations;

alter policy governance_invitations_target_read on public.governance_invitations
  using (
    target_profile_id = (select auth.uid())
    or (
      kind = 'expression_role'
      and public.has_permission(organization_id, 'members.invite', branch_id)
      and public.has_permission(organization_id, 'roles.assign', branch_id)
    )
    or (kind = 'platform_role' and public.has_platform_permission('platform.roles.manage'))
  );
drop policy governance_invitations_expression_read on public.governance_invitations;
drop policy governance_invitations_platform_read on public.governance_invitations;

alter policy follow_ups_self_read on public.live_follow_ups
  using (
    profile_id = (select auth.uid())
    or public.can_receive_pastoral_followups(organization_id, branch_id)
  );
drop policy follow_ups_ministry_read on public.live_follow_ups;

alter policy memberships_read_self on public.memberships
  using (
    profile_id = (select auth.uid())
    or public.has_permission(organization_id, 'members.read', branch_id)
  );
drop policy memberships_read_authorized on public.memberships;

alter policy ministries_read on public.ministries
  using (
    public.can_read_branch_scoped_resource(organization_id, branch_id)
    or public.has_permission(organization_id, 'units.manage', branch_id)
  );
drop policy ministries_manage on public.ministries;
create policy ministries_manage_insert on public.ministries for insert to authenticated
  with check (public.has_permission(organization_id, 'units.manage', branch_id));
create policy ministries_manage_update on public.ministries for update to authenticated
  using (public.has_permission(organization_id, 'units.manage', branch_id))
  with check (public.has_permission(organization_id, 'units.manage', branch_id));
create policy ministries_manage_delete on public.ministries for delete to authenticated
  using (public.has_permission(organization_id, 'units.manage', branch_id));

alter policy attempts_donor_read on public.payment_attempts
  using (
    exists (
      select 1 from public.donations d
      where d.id = payment_attempts.donation_id
        and d.donor_profile_id = (select auth.uid())
    )
    or public.has_permission(organization_id, 'giving.finance.read')
  );
drop policy attempts_finance_read on public.payment_attempts;

alter policy platform_user_restrictions_self_read on public.platform_user_restrictions
  using (
    profile_id = (select auth.uid())
    or public.has_platform_permission('platform.users.read')
  );
drop policy platform_user_restrictions_authority_read on public.platform_user_restrictions;

alter policy prayer_routes_recipient_read on public.prayer_request_routes
  using (
    public.can_receive_prayer_intake(organization_id, branch_id)
    or exists (
      select 1
      from public.memberships m
      join public.role_assignments ra
        on ra.membership_id = m.id and ra.organization_id = m.organization_id
      join public.role_permissions rp
        on rp.role_id = ra.role_id and rp.permission_code = 'roles.assign'
      where m.profile_id = (select auth.uid())
        and m.organization_id = prayer_request_routes.organization_id
        and m.status = 'active'::public.membership_status
        and (ra.expires_at is null or ra.expires_at > now())
        and (
          (prayer_request_routes.branch_id is null and ra.branch_id is null)
          or ra.branch_id = prayer_request_routes.branch_id
        )
    )
  );
drop policy prayer_routes_manager_read on public.prayer_request_routes;

alter policy posting_controls_self_read on public.profile_posting_controls
  using (
    profile_id = (select auth.uid())
    or public.has_platform_permission('platform.users.read')
  );
drop policy posting_controls_platform_read on public.profile_posting_controls;

alter policy profiles_read_self on public.profiles
  using (
    id = (select auth.uid())
    or public.can_read_member_profile(id)
  );
drop policy profiles_read_authorized_members on public.profiles;

alter policy receipts_owner_read on public.receipts
  using (
    issued_to_profile_id = (select auth.uid())
    or public.has_permission(organization_id, 'giving.finance.read')
  );
drop policy receipts_finance_read on public.receipts;

alter policy refunds_donor_read on public.refunds
  using (
    exists (
      select 1 from public.donations d
      where d.id = refunds.donation_id
        and d.donor_profile_id = (select auth.uid())
    )
    or public.has_permission(organization_id, 'giving.finance.read')
  );
drop policy refunds_finance_read on public.refunds;

alter policy role_assignments_read_self on public.role_assignments
  using (
    exists (
      select 1 from public.memberships m
      where m.id = role_assignments.membership_id
        and m.profile_id = (select auth.uid())
    )
    or public.has_permission(organization_id, 'roles.read', branch_id)
  );
drop policy role_assignments_read_authorized on public.role_assignments;

alter policy volunteer_applications_self on public.volunteer_applications
  using (
    exists (
      select 1 from public.memberships m
      where m.id = volunteer_applications.membership_id
        and m.profile_id = (select auth.uid())
    )
    or public.has_permission(organization_id, 'volunteers.manage')
  );
drop policy volunteer_applications_manage on public.volunteer_applications;

alter policy volunteer_schedules_self on public.volunteer_schedules
  using (
    exists (
      select 1 from public.memberships m
      where m.id = volunteer_schedules.membership_id
        and m.profile_id = (select auth.uid())
    )
    or public.has_permission(organization_id, 'volunteers.manage')
  );
drop policy volunteer_schedules_manage on public.volunteer_schedules;
create policy volunteer_schedules_manage_insert on public.volunteer_schedules for insert to authenticated
  with check (public.has_permission(organization_id, 'volunteers.manage'));
create policy volunteer_schedules_manage_update on public.volunteer_schedules for update to authenticated
  using (public.has_permission(organization_id, 'volunteers.manage'))
  with check (public.has_permission(organization_id, 'volunteers.manage'));
create policy volunteer_schedules_manage_delete on public.volunteer_schedules for delete to authenticated
  using (public.has_permission(organization_id, 'volunteers.manage'));
