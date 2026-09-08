-- Advisor hardening for destructive moderation foreign-key access paths.

create index if not exists platform_moderation_deletions_organization_idx
on public.platform_moderation_deletions(organization_id)
where organization_id is not null;
