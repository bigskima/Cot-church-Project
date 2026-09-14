-- Internal workers and trigger functions must never be callable from the public
-- Data API. They continue to run from pg_cron / database triggers as their owner.

-- Scheduled announcement publishing is invoked by pg_cron. Keep service_role as
-- the only API role with an explicit manual-execution escape hatch.
revoke all on function public.publish_due_announcements(timestamptz)
  from public, anon, authenticated;
grant execute on function public.publish_due_announcements(timestamptz)
  to service_role;

-- These functions are trigger-only bookkeeping bridges. Trigger execution does
-- not require Data API callers to hold EXECUTE, so remove every API-role grant.
revoke all on function public.record_succeeded_donation_in_finance_ledger()
  from public, anon, authenticated, service_role;
revoke all on function public.record_succeeded_refund_in_finance_ledger()
  from public, anon, authenticated, service_role;

comment on function public.publish_due_announcements(timestamptz) is
  'Internal scheduled publisher. Executed by pg_cron; direct anon/authenticated execution is prohibited.';
comment on function public.record_succeeded_donation_in_finance_ledger() is
  'Internal donation trigger bridge. Not callable through the Data API.';
comment on function public.record_succeeded_refund_in_finance_ledger() is
  'Internal refund trigger bridge. Not callable through the Data API.';
