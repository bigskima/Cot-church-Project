-- Cover the composite branch/organization foreign keys in their constraint column order.

create index if not exists expression_chat_messages_branch_org_idx
  on public.expression_chat_messages(branch_id, organization_id);

create index if not exists expression_chat_uploads_branch_org_idx
  on public.expression_chat_uploads(branch_id, organization_id);
