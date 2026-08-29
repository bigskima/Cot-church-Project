# Edge API v1

All Edge Functions return one of the following envelopes:

```json
{ "data": {}, "meta": { "requestId": "..." } }
```

```json
{ "error": { "code": "...", "message": "...", "requestId": "..." } }
```

Authenticated endpoints require `Authorization: Bearer <access-token>`. Tenant endpoints also use `X-Organization-Id`; branch-specific operations use `X-Branch-Id`. Clients must treat permission codes returned by the API as capabilities rather than hardcoding role names.

## Identity

| Function | Method | Authentication | Purpose |
| --- | --- | --- | --- |
| `signup` | POST | Public | Register with email or E.164 phone number. |
| `login` | POST | Public | Exchange email/phone credentials for a session. |
| `verify-otp` | POST | Public | Verify an email or phone authentication code. |
| `password-recovery` | POST | Public | Initiate an enumeration-resistant recovery flow. |
| `profile` | GET, PATCH | Required | Read or update the authenticated profile. |

## Tenancy

| Function | Method | Authentication | Purpose |
| --- | --- | --- | --- |
| `organization-context` | GET | Required | List active memberships and resolve effective permissions. |
| `organizations` | GET | Required | List available organizations or read selected organization. |
| `organizations` | POST | Required | Transactionally provision an organization and owner access. |
| `organizations` | PATCH | Required + `organizations.update` | Update selected organization configuration. |
| `branches` | GET | Required membership | List branches/expressions in the selected organization. |
| `branches` | POST | Required + `branches.create` | Create a tenant-safe branch/expression. |
| `branches` | PATCH | Required + `branches.update` | Update the branch/expression selected by the `id` query parameter. |

## Membership and permissions

| Function | Method | Authorization | Purpose |
| --- | --- | --- | --- |
| `memberships` | GET | `members.read` | List and filter tenant memberships. |
| `memberships` | PATCH | `members.update` | Change membership status or branch while protecting the final owner. |
| `roles` | GET | `roles.read` | List tenant roles and permission codes. |
| `roles` | POST, PATCH | `roles.manage` | Create or update custom roles; system roles are immutable. |
| `permissions` | GET | `roles.read` | List the active database-driven permission catalog. |
| `role-assignments` | GET | `roles.read` | List tenant role grants. |
| `role-assignments` | POST, DELETE | `roles.assign` | Grant or revoke scoped, optionally expiring roles. |

## Events, attendance, and audit

| Function | Method | Authorization | Purpose |
| --- | --- | --- | --- |
| `events` | GET | Active membership | List upcoming or retrieve selected events. |
| `events` | POST, PATCH | `events.create`, `events.update` | Create and manage event lifecycle and registration configuration. |
| `event-registrations` | GET, POST | Active membership | List personal registrations or register with capacity-aware waitlisting. |
| `attendance` | GET, POST | `attendance.read`, `attendance.manage` | View attendance or idempotently check in a member. |
| `audit-log` | GET | `audit.read` | Query immutable tenant audit records. |

## Church operations

| Function | Method | Authorization | Purpose |
| --- | --- | --- | --- |
| `organization-units` | GET, POST, PATCH | Membership / `units.manage` | Manage departments and ministries selected by `type`. |
| `groups` | GET | Active membership | Discover visible groups. |
| `groups` | POST, PATCH | `groups.manage` | Create and administer groups. |
| `groups` membership actions | POST | Membership / `groups.members.manage` | Request, approve, or decline group membership. |
| `prayer-requests` | GET, POST, PATCH | Owner / `prayer.moderate` | Submit and securely process privacy-scoped prayer requests. |
| `volunteers` | GET, POST, PATCH | Membership / `volunteers.manage` | Discover, apply for, and administer volunteer opportunities and schedules. |
| `announcements` | GET, POST, PATCH | Membership / `announcements.manage` | Read, draft, schedule, update, and publish announcements. |
| `notification-settings` | GET, PUT, POST, DELETE | Owner | Manage delivery preferences and push devices. |
| `conversations` | GET, POST | Participant | Create conversations, list messages, and send replies. |
| `notifications` | GET, PATCH | Recipient | Read the personal inbox and update read state. |
| `notification-dispatch` | POST | Worker secret | Claim and acknowledge durable email, SMS, and push jobs. |
| `membership-invitations` | GET, POST, DELETE | `members.invite` | List, create, deliver, and revoke membership invitations. |
| `membership-invitations` | PUT | Authenticated identity | Accept an invitation after verified contact matching. |

## Giving and finance

| Function | Method | Authorization | Purpose |
| --- | --- | --- | --- |
| `giving` | GET | Member / owner | List active campaigns, personal donations, and personal receipts. |
| `giving` | POST | Member / `giving.campaigns.manage` | Create idempotent donation intents or campaigns. |
| `giving` | PATCH | `giving.campaigns.manage` | Manage campaign lifecycle and targets. |
| `finance` | GET | `giving.finance.read` | Retrieve bounded, currency-separated giving summaries. |
| `finance` | POST | `giving.refunds.manage` | Request a concurrency-safe full or partial refund. |
| `payment-events` | POST | Verified internal payment adapter | Idempotently normalize signed provider events, finalize donations, and issue receipts. |

## Digital platform, automation, and intelligence

| Function | Method | Authorization | Purpose |
| --- | --- | --- | --- |
| `live-streams` | GET, POST, PATCH | Member / `streams.manage` | Discover, schedule, operate, end, and archive live or recorded services. |
| `public-content` | GET | Public | Retrieve explicitly public streams, recordings, and social posts. |
| `social-feed` | GET, POST | Scoped member / `feed.post` | Read public, organization, branch, group, or private feeds and publish posts, comments, and reactions. |
| `reports` | GET | `reports.read` | Retrieve bounded organization dashboards across membership, events, attendance, giving, and engagement. |
| `integrations` | GET, POST, PATCH | `integrations.manage` | Configure external adapters using secret references rather than raw credentials. |
| `workflow-dispatch` | POST | Worker secret | Claim, complete, retry, and dead-letter durable workflow runs. |
| `streaming-broadcasts` | POST, PATCH | `streams.broadcast` | Provision ingest endpoints via configured provider adapter and control live broadcasts. |
| `streaming-webhook` | POST | Public webhook (signed) | Normalize and ingest provider webhooks idempotently. |
| `streaming-recordings` | GET, POST | `streams.recordings.manage` | Manage replay assets, create clips, and persist metadata. |
| `stream-access` | POST | Active membership / Permitted | Request signed playback grants and establish viewer sessions. |
| `ai-gateway` | POST | `ai.use` | Execute capability-routed prompts with fallback and budget enforcement. |
| `ai-review` | GET, POST | `ai.review` | Review, approve, or reject human-in-the-loop AI drafts. |

## Runtime configuration

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (only functions using the admin client)
- `ALLOWED_ORIGINS` as a comma-separated exact-origin allowlist
- `PASSWORD_RECOVERY_REDIRECT_URL`
- `NOTIFICATION_WORKER_SECRET`
- `RATE_LIMIT_PEPPER`
- `PAYMENT_WEBHOOK_SECRET`
- `WORKFLOW_WORKER_SECRET`

Secrets must be supplied by the deployment environment and must never be committed.
