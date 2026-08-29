import { readFile } from 'node:fs/promises';

const migrationPaths = [
  'supabase/migrations/20260824143315_core_tenancy.sql',
  'supabase/migrations/20260824143316_rbac.sql',
  'supabase/migrations/20260824143317_organization_operations.sql',
  'supabase/migrations/20260824143318_membership_rbac_operations.sql',
  'supabase/migrations/20260824143319_audit_events_attendance.sql',
  'supabase/migrations/20260824143320_church_operations.sql',
  'supabase/migrations/20260824143321_volunteers_communications.sql',
  'supabase/migrations/20260824143322_messaging_notification_delivery.sql',
  'supabase/migrations/20260824143323_phase1_hardening.sql',
<<<<<<< ours
<<<<<<< ours
=======
  'supabase/migrations/20260825100000_giving_finance.sql',
  'supabase/migrations/20260825110000_phase3_platform_intelligence.sql',
>>>>>>> theirs
=======
  'supabase/migrations/20260825100000_giving_finance.sql',
  'supabase/migrations/20260825110000_phase3_platform_intelligence.sql',
>>>>>>> theirs
];

const requiredPatterns = [
  /alter table public\.profiles enable row level security/i,
  /alter table public\.organizations enable row level security/i,
  /alter table public\.memberships enable row level security/i,
  /create function public\.has_permission/i,
  /security definer\s+set search_path = ''/i,
  /create table public\.role_assignments/i,
  /create function public\.create_organization/i,
  /organizations_update_authorized/i,
  /create function public\.assign_role/i,
  /last active owner cannot be removed/i,
  /create table public\.audit_log/i,
  /create function public\.register_for_event/i,
  /create function public\.check_in_member/i,
  /create table public\.groups/i,
  /create table public\.prayer_requests/i,
  /create table public\.notification_outbox/i,
  /create function public\.publish_announcement/i,
  /create table public\.conversations/i,
  /create function public\.claim_notification_outbox/i,
  /create table public\.membership_invitations/i,
  /create function public\.consume_rate_limit/i,
  /create table public\.api_idempotency_keys/i,
<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
  /create table public\.payment_provider_events/i,
  /create function public\.process_payment_result/i,
  /create table public\.receipts/i,
  /create table public\.live_streams/i,
  /create table public\.social_posts/i,
  /create function public\.claim_workflow_runs/i,
  /create function public\.claim_integration_deliveries/i,
  /create function public\.organization_dashboard/i,
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
];

const source = (await Promise.all(migrationPaths.map((path) => readFile(path, 'utf8')))).join('\n');
const missing = requiredPatterns.filter((pattern) => !pattern.test(source));

if (missing.length > 0) {
  console.error('Foundation check failed. Missing:', missing.map(String).join(', '));
  process.exitCode = 1;
} else {
  console.log(`Foundation check passed (${requiredPatterns.length} security and tenancy invariants).`);
}
