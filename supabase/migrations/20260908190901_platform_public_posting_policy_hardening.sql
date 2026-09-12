-- Follow-up for production environments where the initial moderation policy
-- migration was applied before the final advisor hardening pass.

drop policy if exists platform_public_posting_policy_no_client_access
on public.platform_public_posting_policy;
create policy platform_public_posting_policy_no_client_access
on public.platform_public_posting_policy
for all to anon, authenticated
using (false)
with check (false);

drop policy if exists platform_public_posting_exemptions_no_client_access
on public.platform_public_posting_exemptions;
create policy platform_public_posting_exemptions_no_client_access
on public.platform_public_posting_exemptions
for all to anon, authenticated
using (false)
with check (false);

create index if not exists platform_public_posting_policy_updated_by_idx
on public.platform_public_posting_policy(updated_by)
where updated_by is not null;

create index if not exists platform_public_posting_exemptions_granted_by_idx
on public.platform_public_posting_exemptions(granted_by)
where granted_by is not null;

revoke all on function public.can_profile_post_publicly(uuid)
from public, anon, authenticated;
grant execute on function public.can_profile_post_publicly(uuid)
to service_role;
