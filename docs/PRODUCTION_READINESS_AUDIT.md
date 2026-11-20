# Production Readiness Audit

**Audit date:** 2026-09-04  
**Architecture authority:** `CITY_OF_TRANSFORMATION_ARCHITECTURE.md`  
**Branch at audit start:** `work`  
**Starting commit:** `d2364c5`

This is the Gate 1 repository baseline. It distinguishes what can be proven from the
checkout from deployment facts that still require access to the target Supabase project.
It must be updated with remote and end-to-end evidence before Gate 1 is closed.

## Executive status

| Area | Repository evidence | Production status |
| --- | --- | --- |
| Workspace | All required structural checks, typechecks, and application builds pass | Buildable locally; deployment not proven |
| Database | 59 forward-only SQL migrations are present | Remote application and drift unknown |
| Edge Functions | 82 function entrypoints are present, plus `_shared` and tests | Deployment/configuration unknown |
| Platform Admin | 19 page modules are present | Static checks/build pass; authenticated journeys not yet proven |
| Mobile | 60 TSX route files are present; web export passes | Native devices and real tenant journeys not yet proven |
| Providers | Adapter/security invariants pass static checks | Credentials, webhooks, and live flows unknown |
| Security | RLS/RBAC invariants are structurally present | Cross-tenant and role-matrix tests against a running database remain open |

## Repository and build evidence

The following passed on the audit date:

- `npm run foundation:check`
- `npm run api:check`
- `npm run apps:check`
- `npm run services:check`
- `npm run admin:typecheck`
- `npm run admin:build`
- `npm run mobile:typecheck`
- `npm run mobile:build`

No tracked working-tree changes existed at the start of the implementation batch. No
merge-conflict markers were reported by the build checks. Passing these checks proves
repository shape and compilation only; it does not prove remote deployment readiness.

`npm run db:verify` is currently blocked because neither the Supabase CLI nor Docker is
installed in this environment. No Supabase link metadata or local application/function
environment file is available in this checkout.

## Environment readiness

Client configuration names are documented, but local runtime values are absent:

| Configuration | Local checkout | Deployed environment |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Missing | Unknown |
| `VITE_API_URL` | Missing | Unknown |
| `EXPO_PUBLIC_ORGANIZATION_ID` | Missing (optional) | Unknown |
| `EXPO_PUBLIC_PAYMENT_PROVIDER` | Missing (optional) | Unknown |

Server configuration names currently documented in `supabase/functions/.env.example`
are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ALLOWED_ORIGINS`, `RATE_LIMIT_PEPPER`, `STREAMING_MUX_PRIMARY`,
`STREAMING_MUX_SIGNING_PRIMARY`, `STREAMING_MUX_WEBHOOK_PRIMARY`,
`AI_OPENAI_PRIMARY`, `AI_GEMINI_PRIMARY`, and `AI_ANTHROPIC_PRIMARY`. Their deployed
presence is unknown; secret values must never be copied into this audit.

## Application findings

### Confirmed shell protections

Repository inspection confirms the mobile root includes `SafeAreaProvider`, renders the
application tree without waiting for remote branding, warms branding in the background,
exports a root route error boundary, and has a not-found route. Both mobile and admin API
clients require deployment-provided base URLs and bound ordinary requests to 15 seconds.
Behavior under offline, slow-network, and forced render failures still needs runtime
evidence.

### Confirmed production blocker corrected in this batch

`IntegrationsJobs` previously displayed invented worker health, latency, activity times,
and queue status from a hardcoded array. This violated the architecture's real-data rule
and could falsely tell an operator that production systems were healthy. The page now
loads `platform-integrations`, represents loading and retryable failure honestly, and
derives queue, webhook, connection, and recent-job totals only from the API response.

### Platform Admin provisional classification

| Classification | Modules |
| --- | --- |
| Real API wiring found; end-to-end test required | Admin Invitations, AI Infrastructure, Audit/Security, Branding, Dashboard, Expression Creators, Expressions Governance, Feature Flags, Giving Configuration, Integrations/Jobs, Members, Operations, Organisations Governance, Payment Infrastructure, Platform Overview, Provider Credentials, Public Directory, Streaming Infrastructure, User Governance |
| Confirmed production-ready | None yet; requires deployed API, permission, mutation, responsive, and failure-path evidence |

### Mobile provisional classification

- **Infrastructure-only routes:** root and nested layouts, index redirect, and not-found.
- **Compatibility/alias routes requiring dead-route review:** duplicate root and tab paths
  for Giving, Live, Reels, Settings, Watch, and leadership journeys.
- **Wired routes requiring real-data, permission, state, and visual verification:** all
  user-facing authentication, Home, Discover, content, community, profile, giving,
  prayer, live, Watch, Reels, assistant, Creator Studio, and leadership routes.
- **Confirmed production-ready:** none yet; compilation alone is insufficient.

No route is approved as production-ready until it has been exercised with the UI matrix
and relevant role/tenant identity from the architecture handover.

## Backend and provider classification

| Domain | Implemented in repository | Deployed | Configured | End-to-end tested |
| --- | --- | --- | --- | --- |
| Authentication and tenant context | Yes | Unknown | Unknown | Unknown |
| Platform governance | Yes | Unknown | Unknown | Unknown |
| Church operations/content/social | Yes | Unknown | Unknown | Unknown |
| Streaming/Mux adapter | Yes | Unknown | Unknown | Unknown |
| AI provider routing | Yes | Unknown | Unknown | Unknown |
| Payments/giving | Yes | Unknown | Unknown | Unknown |
| Notifications/workflows/integrations | Yes | Unknown | Unknown | Unknown |

## Security status

- Structural scripts pass for tenancy, authorization, webhook verification, input
  validation, and provider adapters.
- Remote migration/RLS state is unknown.
- Organisation-to-organisation and Expression-to-Expression isolation are not yet proven
  with separate authenticated identities.
- Ordinary member, media, finance, pastoral, Expression administrator, organisation
  administrator, and Platform Admin capability matrices remain untested end to end.
- Confidential pastoral visibility and append-only audit behavior remain unverified
  against a running target database.

## Immediate production priorities

1. Obtain target Supabase project access and record remote migration/function inventories
   without exposing credentials.
2. Configure safe local/staging client endpoints and execute shell failure scenarios.
3. Create the role/tenant test identities and run direct API isolation tests before
   approving further operational UI.
4. Continue removing fabricated operational status, then verify each affected page
   against honest loading, empty, error, and permission-denied states.
5. Prove one complete provider-backed journey at a time, beginning with authentication
   and tenant selection before streaming, AI, payments, or dispatch workers.

## Gate 1 decision

**Open.** The repository baseline is healthy and the first confirmed fabricated-data
blocker has been removed, but remote state, secrets, deployed functions, role isolation,
and provider flows remain unknown. Gate 2 work may proceed only for already-confirmed
shell blockers while these external verification items are being obtained.
