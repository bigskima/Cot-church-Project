create index if not exists ai_pastoral_alerts_assigned_to_idx
on public.ai_pastoral_alerts(assigned_to);

create index if not exists ai_pastoral_alerts_branch_org_idx
on public.ai_pastoral_alerts(branch_id, organization_id);
