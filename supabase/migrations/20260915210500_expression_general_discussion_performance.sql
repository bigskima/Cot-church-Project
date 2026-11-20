-- Follow-up tuning for Expression General Discussion.
-- Keep member-read RLS semantics unchanged while avoiding per-row auth.uid() evaluation,
-- and cover foreign keys used by moderation, replies and scoped cleanup queries.

create index if not exists expression_chat_messages_org_branch_idx
  on public.expression_chat_messages(organization_id, branch_id);
create index if not exists expression_chat_messages_reply_to_idx
  on public.expression_chat_messages(reply_to_id)
  where reply_to_id is not null;
create index if not exists expression_chat_messages_pinned_by_idx
  on public.expression_chat_messages(pinned_by_profile_id)
  where pinned_by_profile_id is not null;

create index if not exists expression_chat_reactions_profile_idx
  on public.expression_chat_reactions(profile_id);

create index if not exists expression_chat_uploads_org_branch_idx
  on public.expression_chat_uploads(organization_id, branch_id);
create index if not exists expression_chat_uploads_uploader_idx
  on public.expression_chat_uploads(uploader_profile_id);

create index if not exists expression_memberships_chat_moderated_by_idx
  on public.expression_memberships(chat_moderated_by_profile_id)
  where chat_moderated_by_profile_id is not null;

drop policy if exists expression_chat_messages_member_read on public.expression_chat_messages;
create policy expression_chat_messages_member_read on public.expression_chat_messages
for select to authenticated
using (exists (
  select 1
  from public.expression_memberships em
  where em.organization_id = expression_chat_messages.organization_id
    and em.branch_id = expression_chat_messages.branch_id
    and em.profile_id = (select auth.uid())
    and em.status = 'active'
    and em.chat_banned_at is null
));

drop policy if exists expression_chat_reactions_member_read on public.expression_chat_reactions;
create policy expression_chat_reactions_member_read on public.expression_chat_reactions
for select to authenticated
using (exists (
  select 1
  from public.expression_chat_messages m
  join public.expression_memberships em
    on em.organization_id = m.organization_id
   and em.branch_id = m.branch_id
   and em.profile_id = (select auth.uid())
   and em.status = 'active'
   and em.chat_banned_at is null
  where m.id = expression_chat_reactions.message_id
));
