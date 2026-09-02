# 06 — Production Testing, Deployment and Immediate Next Steps

## Current high-level status

Treat these as a working assessment, not proof of perfect production readiness.

### Foundation / tenancy

Substantially implemented.

### RBAC / security model

Substantially implemented, but must be verified end-to-end and against remote Supabase state.

### Church operations

Substantially implemented across events, attendance, groups/units, volunteers, prayer, announcements, invitations and communications.

### Giving / finance

Substantially implemented, including provider-neutral flows, receipts/refunds/reconciliation concepts. Real provider configuration and end-to-end verification remain essential.

### Workflow / automation / notifications

Substantially implemented. Verify workers, secrets, retries and production dispatch.

### Livestream infrastructure

Significant provider-neutral architecture exists, with Mux as a current/first adapter. Verify actual deployment, secrets, webhook signing, stream lifecycle and mobile operation end-to-end.

### AI gateway

Significant provider-neutral architecture exists for OpenAI/Gemini/Anthropic-style adapters/capabilities. Verify real provider keys/config, model routes, budget/fallback logic and client UX.

### Content / media / social ecosystem

Substantial architecture exists for `content_items`, media, Reels, Watch, sermons, follows, engagement, search, Creator Studio and playback progress. Continue production integration and media-provider testing.

### Platform Admin

Substantially built and now correctly oriented toward Platform Governance & Infrastructure rather than church operations. Continue functional, permission, API, responsive and visual validation.

### Mobile

Substantially built and currently in a major production UX/rebrand/integration phase. The Navy/White redesign has begun. Continue it consistently across the full application while preserving real backend functionality.

## Important documentation drift

Older documentation still contains superseded decisions.

Known examples:

- Brown/Gold mobile styling is obsolete.
- Older six-tab navigation is obsolete; current preference is five primary visible tabs with Live contextually accessible.
- Platform Admin must not be treated as church operational admin.
- Expression is the canonical product term even though legacy backend uses branch terminology.
- Streaming must remain provider-neutral even if Mux is currently the first adapter.
- AI must remain provider-neutral.
- UI must not fabricate business data.

When old docs conflict with this handover, this handover wins. After confirming implementation, update old docs so drift is reduced.

## First-day / inheritance workflow

Before writing new feature code:

1. clone/check out the repository
2. read all files in `docs/DEV_HANDOVER/`
3. read `README.md`
4. read `backend/roadmap.md`
5. read `backend/api.md`
6. read `docs/FULLARCTECT.MD` while noting obsolete presentation sections
7. inspect all migrations
8. inspect Edge Functions and shared utilities
9. inspect shared types
10. inspect `apps/admin`
11. inspect the full `apps/mobile` route tree
12. inspect design-system tokens/theme/session/context code
13. inspect environment example files
14. run all repository validation commands

Do not begin by redesigning architecture from scratch.

## Required audit deliverable

Before the next major implementation batch, produce a concise but concrete audit with:

### Repository state

- current branch/commit
- workspace/build health
- known merge conflicts or dead code

### Database state

- migration list
- which migrations are confirmed applied remotely
- schema drift if any
- RLS concerns

### Edge Functions

For each critical function classify:

- implemented
- deployed
- configured
- tested
- blocked by missing secret/provider

### Environment

List required configuration without exposing secret values.

Classify each required variable/secret as:

- present
- missing
- unknown

### Platform Admin

For each module identify:

- loads real API data
- mutation works
- permission correct
- error state correct
- production-ready / incomplete

### Mobile

Classify routes/components as:

- production-ready
- wired but incomplete
- visually obsolete/incomplete
- contains fake/static business fallback
- broken/dead route

### Providers

Report readiness for:

- streaming
- media
- AI
- payments
- notifications/communication

### Security

Report:

- RLS status
- cross-tenant test status
- role-scope test status
- confidential pastoral boundary status

### Next actions

Prioritize the smallest set of production-critical changes that unlock real end-to-end readiness.

## Mandatory repository checks

Run the existing scripts:

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

Also verify the relevant Expo web/native start/build commands used by the workspace.

## Do not trust `COMPLETE` labels blindly

A roadmap/domain may be marked complete because its architecture/code exists.

Production readiness still requires confirmation of:

- migration deployment
- remote schema
- Edge Function deployment
- provider credentials
- RLS behavior
- real client flow
- webhook behavior
- failure/retry behavior
- observability

## End-to-end test: authentication/tenancy

Verify:

- signup/login
- OTP where used
- password recovery
- session refresh/restoration
- organisation context
- expression context
- logout
- multi-membership context

## End-to-end test: tenant isolation

Explicitly prove:

- Organisation A cannot read Organisation B private data.
- Organisation A cannot mutate Organisation B resources.
- Expression A user cannot manage Expression B resources without permission/scope.
- Public search cannot leak private tenant data.

## End-to-end test: RBAC

Test users with intentionally different capabilities:

- ordinary member
- media role
- finance role
- pastoral role
- expression administrator
- organisation administrator
- Platform Admin

Verify both visible UI and direct backend denial.

## End-to-end test: livestream

Required real flow:

`Platform Admin configures/validates provider infrastructure → Expression Media Leader creates/schedules stream → backend resolves provider → ingest credentials issued securely → encoder connects → provider webhook updates live state → member playback works → stream ends → recording processes → recording ready → sermon draft created → authorized publisher publishes`.

Test also:

- invalid/missing provider config
- encoder not connected
- reconnect
- failed webhook
- duplicate webhook
- stream termination
- recording failure
- unauthorized expression access

## End-to-end test: content/media

Verify:

- upload intent
- real upload
- processing
- ready state
- playback grant
- post publish
- Reel publish/playback
- Watch publish/playback
- sermon audio/video modes
- comments/replies
- reactions
- bookmark
- follow
- progress sync
- search
- visibility
- moderation/report

## End-to-end test: giving

Required flow:

`Campaign/Category → Donation Intent → Provider → Signed/Verified Event → Donation Finalized → Receipt → Finance Reporting/Reconciliation`.

Test:

- provider failure
- duplicate callback/webhook
- refund where supported
- unauthorized finance access
- currency separation
- retry/idempotency

## End-to-end test: prayer/pastoral

Verify:

- member submission
- each supported privacy level
- pastoral/prayer-team access
- unauthorized denial
- status assignment/update
- confidential content not visible to unrelated leaders/platform support

## End-to-end test: notifications

Verify:

- in-app notification creation
- read/unread
- deep link
- push device registration where configured
- dispatch worker
- invalid device cleanup/retry where supported

## UI test matrix

Test both Light and Dark modes across:

- small Android
- typical Android
- iPhone where available
- tablet
- mobile web widths 320/360/390/430
- tablet web
- desktop web

Test:

- long organisation names
- long expression names
- long user names
- long titles
- missing images
- no data
- large datasets
- network timeout
- offline
- 401/403/404/500
- slow loading
- feature disabled

## Accessibility QA

Verify:

- touch target sizes
- labels/roles for controls
- keyboard focus/navigation on web
- contrast
- text scaling tolerance
- status not communicated by color alone

## Performance QA

Audit:

- repeated API calls
- waterfalls
- unbounded lists
- missing pagination
- unnecessary realtime subscriptions
- oversized media
- multiple simultaneous video players
- stale permission caching

## Production deployment rules

Use the actual repository, Supabase project and deployment environment.

Do not create disconnected replacement environments for the final production build unless intentionally establishing staging/preview.

Maintain clear separation between:

- development
- preview/staging
- production

Do not point every local developer workflow at production by default.

## Git workflow

Use meaningful branches/commits/PRs.

Never commit secrets or `.env` values containing private credentials.

For major changes, document:

- what changed
- migrations
- API changes
- RLS/security changes
- required environment variables/secrets
- provider changes
- test evidence
- deployment steps
- known risks

## Immediate priority order

Recommended next order after inheritance audit:

1. get all root checks green
2. verify remote Supabase migration/schema state
3. verify critical Edge Functions and secrets
4. verify auth/tenant/RBAC end-to-end
5. verify Platform Admin governance boundaries and real data
6. finish Navy/White mobile redesign across all remaining screens
7. remove static/fake business fallbacks and dead actions
8. test livestream end-to-end with real provider
9. test media upload/playback and content publishing
10. test prayer confidentiality
11. test giving/payment verification
12. test notification delivery/deep links
13. test cross-tenant isolation
14. responsive/accessibility/performance hardening
15. production deployment verification

## Definition of done — backend

A backend feature requires:

- migration/schema
- constraints
- RLS/authorization
- API/RPC/function
- validation
- correct tenant scope
- idempotency where needed
- audit where needed
- safe error contract
- tests/checks
- docs
- deployment path

## Definition of done — UI

A screen requires:

- current design system
- Light/Dark support
- real backend/provider data
- correct capability and scope
- loading
- empty
- error
- offline consideration
- functional routes/actions
- no fabricated business values
- responsive behavior
- accessibility
- build/typecheck success

## Final inheritance rule

You are inheriting an advanced, partially completed production platform.

Do not erase its history. Do not repeat previously corrected mistakes. Verify reality, preserve valid foundations, and complete the system with production discipline.