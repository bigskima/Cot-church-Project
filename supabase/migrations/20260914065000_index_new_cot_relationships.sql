-- Cover foreign-key relationship paths introduced by the Sep 13/14 COT build.
-- These indexes improve deletes/joins and remove avoidable full scans without
-- attempting a risky whole-database index rewrite in the same release.

-- Rich direct/group chat.
create index if not exists chat_media_uploads_uploader_idx
  on public.chat_media_uploads(uploader_profile_id);
create index if not exists chat_media_uploads_org_idx
  on public.chat_media_uploads(organization_id);
create index if not exists chat_media_uploads_group_scope_idx
  on public.chat_media_uploads(group_id, organization_id);
create index if not exists chat_media_uploads_section_scope_idx
  on public.chat_media_uploads(section_id, group_id, organization_id);

create index if not exists group_chat_sections_creator_idx
  on public.group_chat_sections(created_by_profile_id);
create index if not exists group_chat_sections_group_scope_idx
  on public.group_chat_sections(group_id, organization_id);
create index if not exists group_chat_sections_org_idx
  on public.group_chat_sections(organization_id);

create index if not exists group_chat_section_members_added_by_idx
  on public.group_chat_section_members(added_by_profile_id);
create index if not exists group_chat_section_members_member_scope_idx
  on public.group_chat_section_members(membership_id, group_id, organization_id);
create index if not exists group_chat_section_members_section_scope_idx
  on public.group_chat_section_members(section_id, group_id, organization_id);
create index if not exists group_chat_section_members_org_idx
  on public.group_chat_section_members(organization_id);

create index if not exists direct_message_reactions_profile_idx
  on public.direct_message_reactions(profile_id);
create index if not exists group_message_reactions_profile_idx
  on public.group_message_reactions(profile_id);
create index if not exists direct_messages_sender_profile_idx
  on public.direct_messages(sender_profile_id);
create index if not exists direct_messages_reply_to_idx
  on public.direct_messages(reply_to_id);
create index if not exists direct_messages_pinned_by_idx
  on public.direct_messages(pinned_by_profile_id);

create index if not exists group_messages_group_org_idx
  on public.group_messages(group_id, organization_id);
create index if not exists group_messages_org_idx
  on public.group_messages(organization_id);
create index if not exists group_messages_sender_idx
  on public.group_messages(sender_profile_id);
create index if not exists group_messages_reply_to_idx
  on public.group_messages(reply_to_id);
create index if not exists group_messages_section_scope_idx
  on public.group_messages(section_id, group_id, organization_id);
create index if not exists group_messages_pinned_by_idx
  on public.group_messages(pinned_by_profile_id);

create index if not exists group_roles_creator_idx
  on public.group_roles(created_by_profile_id);
create index if not exists group_roles_group_org_idx
  on public.group_roles(group_id, organization_id);
create index if not exists group_roles_org_idx
  on public.group_roles(organization_id);

create index if not exists group_role_assignments_assigned_by_idx
  on public.group_role_assignments(assigned_by_profile_id);
create index if not exists group_role_assignments_member_scope_idx
  on public.group_role_assignments(membership_id, group_id, organization_id);
create index if not exists group_role_assignments_role_scope_idx
  on public.group_role_assignments(role_id, group_id, organization_id);
create index if not exists group_role_assignments_org_idx
  on public.group_role_assignments(organization_id);

create index if not exists group_announcements_creator_idx
  on public.group_announcements(created_by_profile_id);
create index if not exists group_announcements_group_org_idx
  on public.group_announcements(group_id, organization_id);
create index if not exists group_announcements_org_idx
  on public.group_announcements(organization_id);

create index if not exists group_events_creator_idx
  on public.group_events(created_by_profile_id);
create index if not exists group_events_group_org_idx
  on public.group_events(group_id, organization_id);
create index if not exists group_events_org_idx
  on public.group_events(organization_id);

create index if not exists group_giving_options_creator_idx
  on public.group_giving_options(created_by_profile_id);
create index if not exists group_giving_options_group_org_idx
  on public.group_giving_options(group_id, organization_id);
create index if not exists group_giving_options_org_idx
  on public.group_giving_options(organization_id);
create index if not exists group_giving_options_purpose_org_idx
  on public.group_giving_options(purpose_id, organization_id);

create index if not exists group_memberships_banned_by_idx
  on public.group_memberships(banned_by_profile_id);
create index if not exists group_memberships_group_org_cover_idx
  on public.group_memberships(group_id, organization_id);
create index if not exists group_memberships_member_org_cover_idx
  on public.group_memberships(membership_id, organization_id);
create index if not exists group_memberships_org_cover_idx
  on public.group_memberships(organization_id);

-- Polls and giveaways.
create index if not exists polls_author_profile_idx
  on public.polls(author_profile_id);
create index if not exists polls_branch_org_idx
  on public.polls(branch_id, organization_id);
create index if not exists polls_social_post_org_idx
  on public.polls(social_post_id, organization_id);
create index if not exists poll_votes_profile_idx
  on public.poll_votes(profile_id);

create index if not exists giveaways_host_profile_idx
  on public.giveaways(host_profile_id);
create index if not exists giveaways_branch_org_idx
  on public.giveaways(branch_id, organization_id);
create index if not exists giveaway_entries_profile_idx
  on public.giveaway_entries(profile_id);
create index if not exists giveaway_winners_profile_idx
  on public.giveaway_winners(profile_id);
create index if not exists giveaway_winners_selected_by_idx
  on public.giveaway_winners(selected_by);

-- Testimony workflow.
create index if not exists testimonies_author_profile_idx
  on public.testimonies(author_profile_id);
create index if not exists testimonies_reviewed_by_idx
  on public.testimonies(reviewed_by);
create index if not exists testimonies_branch_org_idx
  on public.testimonies(branch_id, organization_id);
create index if not exists testimony_responses_testimony_idx
  on public.testimony_responses(testimony_id);
create index if not exists testimony_responses_responder_idx
  on public.testimony_responses(responder_profile_id);
create index if not exists testimony_responses_branch_org_idx
  on public.testimony_responses(branch_id, organization_id);

-- Expression documentation finance.
create index if not exists financial_accounts_branch_org_idx
  on public.financial_accounts(branch_id, organization_id);
create index if not exists financial_accounts_created_by_idx
  on public.financial_accounts(created_by);

create index if not exists financial_sessions_org_idx
  on public.financial_sessions(organization_id);
create index if not exists financial_sessions_branch_org_idx
  on public.financial_sessions(branch_id, organization_id);
create index if not exists financial_sessions_opened_by_idx
  on public.financial_sessions(opened_by);
create index if not exists financial_sessions_reconciled_by_idx
  on public.financial_sessions(reconciled_by);

create index if not exists financial_ledger_account_idx
  on public.financial_ledger_entries(account_id);
create index if not exists financial_ledger_branch_org_idx
  on public.financial_ledger_entries(branch_id, organization_id);
create index if not exists financial_ledger_session_idx
  on public.financial_ledger_entries(session_id);
create index if not exists financial_ledger_purpose_idx
  on public.financial_ledger_entries(giving_purpose_id);
create index if not exists financial_ledger_campaign_idx
  on public.financial_ledger_entries(giving_campaign_id);
create index if not exists financial_ledger_contributor_idx
  on public.financial_ledger_entries(contributor_profile_id);
create index if not exists financial_ledger_recorded_by_idx
  on public.financial_ledger_entries(recorded_by);

-- Feed controls added by this build.
create index if not exists feed_ranking_settings_branch_org_idx
  on public.feed_ranking_settings(branch_id, organization_id);
create index if not exists feed_ranking_settings_updated_by_idx
  on public.feed_ranking_settings(updated_by);
