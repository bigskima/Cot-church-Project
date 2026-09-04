# Build In Progress

## Source of truth

`CITY_OF_TRANSFORMATION_ARCHITECTURE.md` is the source of truth for this build.
The implementation must inherit and verify the existing system rather than redesign it.
Where that architecture directs the developer to a more detailed working checklist,
use `docs/DEV_HANDOVER/06_PRODUCTION_TESTING_DEPLOYMENT_AND_NEXT_STEPS.md` without
changing the architecture, authority boundaries, or product rules.

## Build order

Work through these gates in order. Do not start a later gate while an earlier gate has
unresolved production blockers.

### 1. Establish the verified baseline

- Run the repository checks listed in Architecture Section 23.
- Compare local migrations with the linked remote Supabase project.
- Inventory deployed Edge Functions and required environment variables/secrets.
- Classify every Platform Admin module and mobile route as production-ready,
  incomplete, visually incomplete, static/fabricated, or broken.
- Record provider readiness and the current RLS/cross-tenant security test status.

**Exit gate:** a dated audit distinguishes code that merely exists from code that is
deployed and proven end to end, and identifies exact production blockers.

### 2. Stabilize the application shell

- Re-verify all five white-screen protections from Architecture Section 21:
  `SafeAreaProvider`, non-blocking bootstrap/branding, root error boundary and
  not-found handling, required runtime API configuration, and bounded API requests.
- Confirm the native splash and first render remain useful when the network is slow or
  unavailable.
- Remove any remaining hardcoded runtime project URLs.

**Exit gate:** cold start, offline start, slow API, failed branding, bad route, and
uncaught render-error scenarios always produce a usable shell or recoverable state,
never a blank screen.

### 3. Prove tenancy, authority, and security

- Verify the three authority layers without introducing parallel role, permission,
  content, or Expression tables.
- Test ordinary member, scoped church roles, organisation admin, and platform admin
  identities against direct API access as well as UI visibility.
- Prove organisation and Expression isolation, private-content search isolation,
  capability separation, and append-only audit behavior.

**Exit gate:** unauthorized and cross-tenant requests are denied server-side, scoped
authorized flows succeed, and sensitive mutations create immutable audit records.

### 4. Complete real API and state wiring

- Replace prototype/static behavior with existing Edge Function APIs and shared types.
- Implement honest loading, empty, retryable error, and success states.
- Preserve the standard API envelope and never expose internal error codes to users.
- Keep all external services behind the existing streaming, AI, payment, and media
  provider adapters.

**Exit gate:** priority user journeys use real tenant-scoped data and permissions with
no fabricated church, schedule, person, giving, live, or viewer information.

### 5. Finish the mobile product experience

- Continue the navy/white redesign using semantic theme tokens and light, dark, and
  system modes; do not reintroduce the retired brown/gold direction.
- Preserve exactly five visible tabs: Home, Discover, Reels, Community, and Profile.
- Finish screens in journey order, including responsive, accessibility, loading,
  empty, error, and permission-denied behavior.

**Exit gate:** every shipped route satisfies the Architecture Section 23 UI definition
of done and is visually checked at representative mobile and web viewports.

### 6. Validate provider-backed production flows

- Exercise streaming lifecycle and webhook flows with configured credentials.
- Exercise AI routing, review, fallback, and failure behavior.
- Exercise payment initiation, webhook verification, reconciliation, refund controls,
  and the boundary between platform payment infrastructure and church-owned giving.
- Exercise communication delivery, retries, and failure reporting.

**Exit gate:** each enabled provider has a successful end-to-end test and a tested safe
failure path; an unconfigured provider reports an honest unavailable state.

### 7. Release readiness

- Re-run all static, type, build, database, security, responsive, and accessibility
  checks.
- Confirm remote migrations, deployed functions, secrets, observability, rollback,
  and operator runbooks.
- Complete role-based acceptance tests for Platform Admin and the mobile application.

**Exit gate:** all blockers from the baseline audit are closed or explicitly deferred
with owner and rationale, and the release evidence proves production behavior rather
than only repository structure.

## Non-negotiable sequencing rules

- Production readiness takes priority over adding features.
- Backend RBAC/RLS is authoritative; client capability checks are UX only.
- Platform Admin governs infrastructure and tenants; church roles operate ministry.
- Product “Expression” continues to use the existing `branches`/`branch_id` backend
  model unless a deliberate backward-compatible migration is separately approved.
- Never fabricate business data.
- A passing structural or type check is evidence for Gate 1, not proof that a provider
  or production deployment works.
