# 02 — Backend, Database, Security and APIs

## Backend stack

The backend uses Supabase as the primary production foundation:

- PostgreSQL
- Supabase Auth
- Edge Functions
- Row Level Security
- Storage where appropriate
- SQL migrations
- RPC/database functions

The backend remains the source of truth. Do not replace production backend logic with frontend mocks.

## Repository backend areas

Inspect before adding anything:

- `supabase/migrations/`
- `supabase/functions/`
- `supabase/functions/_shared/`
- `backend/api.md`
- `backend/roadmap.md`
- shared types under `packages/`
- root validation scripts under `scripts/`

The repository already contains a substantial migration history and many Edge Functions. Never create duplicate domains because you failed to search first.

## Existing major backend domains

The implemented architecture already covers substantial parts of:

### Tenancy and identity

- profiles
- organisations
- branches/expressions
- organisation membership
- context resolution
- membership invitations

### Dynamic RBAC

- roles
- permissions
- role permissions
- scoped role assignments
- effective permission resolution

### Church operations

- events
- registrations
- attendance
- organisation units
- groups
- volunteers
- prayer requests
- announcements
- conversations
- notifications

### Finance

- giving campaigns
- donation intents
- receipts
- payment events
- finance reporting
- refunds
- reconciliation

### Platform and automation

- reports
- integrations
- workflows
- durable workers/outboxes
- audit
- feature/configuration systems

### Digital content/media

- live streams
- streaming broadcasts
- recordings
- stream access
- public content
- social feed
- creator studio
- content/media pipeline
- engagement
- follows
- sermons
- reels/videos/Watch concepts

### Intelligence

- AI gateway
- AI review

Inspect the actual schema/functions before changing or adding equivalent functionality.

## Migration rules

All schema evolution must be captured in migrations.

Before creating a migration:

1. inspect existing migrations
2. inspect current remote schema
3. identify existing tables/functions/enums
4. understand RLS and trigger dependencies
5. assess existing data
6. use backward-compatible evolution where possible
7. avoid destructive renames or table duplication

Do not reset production databases.

Do not manually mutate production schema and leave migration history behind.

## Legacy branch terminology

The database currently uses `branches`, `branch_id` and related API headers. Product terminology is now Expression.

Do not create duplicate structures merely to rename the concept. If renaming is eventually desired, design a safe compatibility/migration plan.

## Database design principles

Use proper relational modelling:

- UUID/appropriate primary keys
- foreign keys
- unique constraints
- check constraints
- indexes
- timestamps
- immutable/audit fields where appropriate
- soft deletion/archiving where history matters
- transactions for multi-step changes

Use JSONB for genuinely flexible metadata, not as a substitute for relational domain modelling.

## Row Level Security

RLS is mandatory for sensitive tenant data.

RLS/back-end authorization must enforce:

- authenticated identity
- organisation membership
- expression/branch scope
- permission/capability
- resource ownership
- visibility
- privacy level

Explicitly test cross-tenant denial.

## Critical isolation tests

Verify at minimum:

- Organisation A cannot read Organisation B confidential data.
- Expression A user cannot manage Expression B content without scope.
- Media role cannot read finance unless granted.
- Finance role cannot operate streaming unless granted.
- Member cannot access leader tools without permission.
- Visitor cannot access member/private content.
- Search does not leak private content.

## API response contract

Edge APIs use normalized success/error envelopes.

Success concept:

```json
{
  "data": {},
  "meta": { "requestId": "..." }
}
```

Error concept:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "requestId": "..."
  }
}
```

Maintain a consistent contract.

## Authentication and tenant transport

Authenticated requests use bearer access tokens.

Existing tenant endpoints use:

- `X-Organization-Id`
- `X-Branch-Id` where relevant

Do not casually remove these conventions. Any transport terminology migration to Expression must be backward-compatible and deliberate.

## Identity APIs

The existing API architecture includes concepts such as:

- signup
- login
- OTP verification
- password recovery
- profile

The client must eventually expose a complete usable authentication lifecycle, including recovery where backend support exists.

## Tenancy APIs

Existing concepts include:

- organisation context
- organisations
- branches/expressions
- memberships
- roles
- permissions
- role assignments
- membership invitations

Clients must use capabilities returned/resolved by the backend rather than hardcoding role names.

## Events/attendance APIs

Existing architecture includes:

- events
- event registrations
- attendance

Events must support production concerns such as capacity, date/time, expression ownership and registration state rather than static UI placeholders.

## Church operations APIs

Existing architecture includes:

- organisation units
- groups
- prayer requests
- volunteers
- announcements
- notification settings
- conversations
- notifications

Do not create second versions before inspecting these functions.

## Finance APIs

Existing architecture includes:

- giving
- finance
- payment events

Payment success is backend/provider verified; never trust a client success callback as final proof.

## Digital platform APIs

Existing architecture includes:

- live-streams
- public-content
- social-feed
- reports
- integrations
- workflow-dispatch
- streaming-broadcasts
- streaming-webhook
- streaming-recordings
- stream-access
- ai-gateway
- ai-review

Use and extend these existing contracts where valid.

## Idempotency

Use idempotency for operations that can be retried or receive duplicate provider events, especially:

- payment webhooks
- streaming webhooks
- donation intent/finalization
- workflow jobs
- notification dispatch
- media provider callbacks

Duplicate requests must not create duplicate financial or operational state.

## Webhook architecture

All provider webhooks should follow a common production pattern:

`Receive → Identify Provider → Verify Signature → Idempotency Check → Persist/Normalize Event → Handle → Mark Outcome → Retry/Dead-letter if required`.

Unsigned or unverifiable provider events must not be trusted.

## Background jobs/workflows

Long-running work should not block interactive client requests unnecessarily.

Examples:

- media processing
- AI transcription/summarisation
- notification delivery
- workflow dispatch
- scheduled tasks
- analytics aggregation

Track status, attempts, max attempts, error reason and completion timestamps.

## Audit

Sensitive changes should generate audit records, including:

- role grants/revokes
- permission changes
- user/tenant suspension
- provider configuration changes
- feature flag changes
- refund operations
- emergency stream termination
- privileged data access where designed

Ordinary admins must not edit audit history.

## Security requirements

Production requirements include:

- least privilege
- RLS
- API authorization
- input validation
- rate limiting where appropriate
- signed webhooks
- safe upload validation
- secure session handling
- no service-role key in clients
- safe structured logs
- abuse controls

Do not log passwords, access tokens, provider secrets, private pastoral content or unnecessary financial sensitive data.

## Secrets

Private secrets belong in trusted deployment configuration, never in client bundles or Git.

Examples:

- Supabase service-role key
- streaming provider secrets
- AI provider keys
- payment provider secret keys
- webhook signing secrets
- worker secrets

Public client environment variables must contain only values safe to expose publicly.

## Observability

Preserve and improve request IDs and structured errors.

Operationally important failures must be diagnosable through:

- request logs
- provider errors
- webhook event status
- worker/job failures
- deployment logs
- health checks
- app error reporting

Do not broadly convert backend failure into `[]` just to make the frontend quiet.

## Root validation commands

Use the existing repository scripts. At minimum, verify:

```bash
npm run foundation:check
npm run api:check
npm run apps:check
npm run services:check
npm run admin:typecheck
npm run admin:build
npm run mobile:typecheck
npm run mobile:build
```

Where local Docker/Supabase CLI are available:

```bash
npm run db:verify
```

A passing structural/type check does not by itself prove deployed production readiness.