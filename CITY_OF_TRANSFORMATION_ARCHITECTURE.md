# CITY OF TRANSFORMATION DIGITAL PLATFORM
## Full Production Architecture & Engineering Handoff Document
### (Verified against `Cot-church-Project`, branch `main`, as of 2026-09-04)

> **How this document was produced:** This is not a rewrite from a blank page. Every claim below was checked against the actual repository — migrations in `supabase/migrations/` (60 files), Edge Functions in `supabase/functions/` (83 functions), the `apps/mobile` route tree, the `apps/admin` page tree, `packages/types`, and the existing internal docs (`README.md`, `backend/architecture.md`, `backend/api.md`, `backend/roadmap.md`, `docs/FULLARCTECT.MD`, `docs/DEV_HANDOVER/00–06`, `docs/WHITE_SCREEN_FINDINGS.md`, `docs/BUILD_IN_PROGRESS.md`). Where this document states something is **implemented**, it means the code exists in the repo. It does not by itself mean it is deployed, has real provider credentials attached, or has been end-to-end tested against a live environment — that distinction matters and is called out explicitly in Section 23.
>
> **Relationship to existing repo docs:** This document does not replace `docs/DEV_HANDOVER/00_READ_ME_FIRST.md` — it consolidates it, `docs/FULLARCTECT.MD`, and the backend docs into the structure you asked for. Your dev should still read the handover pack in the repo; treat that pack and this document as describing the same system from two angles.

---

## 1. Executive Product Definition

### What the platform is

The City of Transformation Digital Platform is a **multi-tenant Church Digital Operating System** — a single codebase that serves any number of independent churches ("Organisations"), each with any number of campuses/branches/ministries ("Expressions"), through one mobile application and one platform-governance web application, backed by one Supabase project.

It is not a single-church app with the church's name hardcoded in. The repository already enforces this: every domain table is scoped by `organization_id` (and, where relevant, `branch_id`/`expression_id`), every Edge Function resolves tenant context from request headers rather than from a constant, and the schema supports an arbitrary number of organisations from day one.

### What problem it solves

Churches currently stitch together a website, a separate livestreaming tool (YouTube/Facebook), a separate giving vendor, a separate church-management system (attendance/members), a separate bulk SMS/email tool, and social media for reach — with no shared identity, no shared permission model, and no shared content graph between any of them. Leadership has no single place to see "who is a member, what did we publish, who's watching, who gave, who volunteered, what's live right now."

This platform replaces that stitched-together stack with one identity graph, one permission model, and one content graph, expressed through:
- a consumer-grade mobile app (visitor → follower → member → leader, all in one app, role-aware)
- a governance web app for platform operators (not church staff)
- a Supabase backend that is the single source of truth for identity, permissions, content, media, streaming, giving, and communication

### Why it is different from a church website

A church website is a one-way publishing surface for one church. This platform is:
- **Multi-tenant by construction** — any number of organisations and expressions, isolated from each other by Row Level Security, not by convention.
- **Bidirectional and social** — follows, reactions, threaded comments, bookmarks, playback progress, a personal feed — not just a page you read.
- **Governed, not just published** — every write path is gated by a database-backed permission, resolved per organisation/expression scope, not by "is this user an admin."
- **Provider-neutral at the infrastructure seams** — streaming, AI, and payments are behind adapter interfaces so the product is never structurally married to Mux, OpenAI, or Stripe.
- **Two separate products with two separate authority models** — a Platform Governance control plane (`apps/admin`) that operates the software, and a single Church/Member application (`apps/mobile`) that operates the ministry. The repo already keeps these as two workspaces with two separate permission namespaces (`platform.*` vs. everything else) — this is a structural fact of the schema, not a UI convention.

### Product philosophy

1. **Real data or an honest empty state — never fabricated data.** This is stated repeatedly and explicitly in the existing handover docs (`docs/DEV_HANDOVER/05`) and is treated as a production blocker, not a style preference: no fake schedules, no fake preacher names, no fake QR member passes, no fake viewer counts.
2. **Backend is the authority; frontend is UX.** Every `hasCapability(...)` check in the client is a convenience for hiding buttons. The only thing that actually stops an unauthorized write is Row Level Security and server-side permission checks in the Edge Function.
3. **Provider abstraction at every external seam.** Streaming, AI, payments, and media storage all sit behind a registry + adapter pattern already present in `supabase/functions/_shared/{streaming,ai,media,payments}/`. New providers are added as new adapter files, not as rewrites.
4. **Inherit, verify, complete — don't rebuild.** This is the single most important operating instruction for whoever picks this repository up next, and it is the subject of Section 2.

---

## 2. Current Codebase Continuation Directive

**This is not a greenfield project. Treat it as an inheritance, not a canvas.**

### Verified current state (as of this document)

| Layer | Verified fact |
| :--- | :--- |
| Database migrations | 60 SQL migration files, `supabase/migrations/`, spanning 2026-08-24 → 2026-09-04 (i.e. changes were still landing the same day this document was produced) |
| Edge Functions | 83 deployed-as-code functions in `supabase/functions/` (excluding `_shared` and `tests`), covering identity, tenancy, RBAC, church operations, finance, streaming, AI, and platform governance |
| Shared types | `packages/types/src/` — 14 domain type modules shared between `apps/mobile` and `apps/admin` |
| Mobile app | `apps/mobile` — Expo Router app with a 5-tab primary navigation, an `(auth)` group, a `leadership/` module, and a `studio/` (Creator Studio) module already routed |
| Admin app | `apps/admin` — Vite + React app with 18 governance pages already scaffolded (`Dashboard`, `PlatformOverview`, `OrganizationsGovernance`, `ExpressionsGovernance`, `UserGovernance`, `StreamingInfrastructure`, `AiInfrastructure`, `PaymentInfrastructure`, `IntegrationsJobs`, `AuditSecurity`, `BrandingAppearance`, `FeatureFlags`, `GivingConfiguration`, `ProviderCredentials`, `PublicDirectory`, `AdminInvitations`, `ExpressionCreators`, `Members`, `Operations`) |
| Existing internal docs | `README.md`, `backend/architecture.md`, `backend/api.md`, `backend/roadmap.md`, `docs/FULLARCTECT.MD` (308 lines — a prior architecture pass that already documents most of this in more database-accurate detail than the version you pasted to me), and a 6-file `docs/DEV_HANDOVER/` pack that is explicitly labeled as the latest source of truth in the repo itself |
| Known, already-diagnosed production bug class | `docs/WHITE_SCREEN_FINDINGS.md` documents five confirmed root causes of a production blank-screen failure (missing `SafeAreaProvider`, render blocked on remote branding fetch, no root error boundary, hardcoded Supabase Functions URL fallback, no request timeout) — see Section 21 |

### For the incoming developer

- **Existing implementation exists.** Do not assume this is a scaffold. Read `docs/DEV_HANDOVER/00_READ_ME_FIRST.md` through `06_...md` in order before writing code. That pack explicitly instructs: *"Do not begin by redesigning architecture from scratch."*
- **Do not discard existing systems.** In particular: do not create a second `expressions` table because the current implementation uses `branches`/`branch_id`/`X-Branch-Id` under the hood (see Section 5's terminology note). Do not create a second content system because you'd prefer a different shape than `content_items` + typed subtypes. Do not create a second permission system because you'd prefer role strings over capability codes.
- **Verify every module before extending it.** A migration existing does not mean it's applied to the remote database. A function existing in `supabase/functions/` does not mean it's deployed. A screen rendering does not mean its data is real. Section 23 gives you the exact audit checklist the repo's own handover pack already prescribes.
- **Production readiness over feature count.** The repo's own roadmap doc states this explicitly: *"A passing structural check alone is not phase completion."* Four backend phases are marked complete in `backend/roadmap.md`; the current work in the repo (per `docs/BUILD_IN_PROGRESS.md`) is application-layer stabilization and UX completion against those APIs, not new backend domains.
- **Remove prototype behaviour and hardcoded assumptions** — but only after confirming with the backend that the "prototype" behaviour isn't actually load-bearing. Some things that look like placeholders (e.g. `branch_id` naming) are intentional legacy compatibility, not sloppiness — see Section 5.

### Existing ≠ Production Ready

A completed screen is not a completed feature. The repo's own `docs/DEV_HANDOVER/06_...md` gives the concrete definition of done for both backend and UI work (reproduced in Section 23). A screen that renders with a working `useResource` call is not done until: it has the correct capability/scope gate, correct loading/empty/error states, no fabricated business data, and has passed responsive + accessibility + build checks.

---

## 3. Complete Technical Stack

### Mobile — `apps/mobile`

- Expo (React Native), targeting native + Expo Web
- TypeScript throughout
- Expo Router — file-based routing under `app/`, using route groups `(auth)` and `(tabs)`
- A dedicated design-system layer (`src/design-system/tokens.ts`, `src/theme/tokens.ts`, `src/theme/provider.tsx`) with light/dark/system theming and semantic tokens — not raw hex values scattered in screens
- Supabase client integration via `src/api.ts`, calling Edge Functions rather than querying Postgres directly from the client
- `.env.example` confirms the only required public client config is `EXPO_PUBLIC_API_URL` (the Edge Functions base URL) plus optional `EXPO_PUBLIC_PAYMENT_PROVIDER` and `EXPO_PUBLIC_ORGANIZATION_ID` (used for anonymous/public-discovery contexts)

### Admin — `apps/admin`

- React web application (Vite)
- TypeScript
- Platform governance interface only — 18 pages, all scoped to platform-level concerns (see Section 18)
- `.env.example` confirms the only required client config is `VITE_API_URL`

### Backend — Supabase

- PostgreSQL as the single source of truth, with 60 forward-only migrations
- Edge Functions (Deno) as the API layer — clients never talk to Postgres directly
- Storage — buckets for avatars, church/branding assets, and content/community media, referenced via `packages/types/src/media.ts` and the `_shared/media` adapters
- Realtime — used for live-presence/stream-state style features (`stream-presence`, `live-interactions` functions exist)
- Authentication — Supabase Auth, supporting both email and E.164 phone number identifiers per `backend/architecture.md`

### External Services — Provider abstraction

The repo already implements the registry+adapter pattern for all four external-service categories, in `supabase/functions/_shared/`:

| Domain | Interface/registry file | Adapters that exist today |
| :--- | :--- | :--- |
| Streaming | `streaming/types.ts`, `streaming/registry.ts` | `streaming/mux.ts` (Mux) |
| AI | `ai/types.ts`, `ai/registry.ts`, `ai/router.ts` | `ai/openai.ts`, `ai/gemini.ts`, `ai/anthropic.ts` |
| Payments | `payments/types.ts`, `payments/registry.ts` | `payments/stripe.ts`, `payments/paystack.ts` |
| Media/storage | `media/types.ts`, `media/registry.ts` | `media/internal.ts` (Supabase Storage), `media/mux.ts` |

This is the concrete mechanism behind every "provider-neutral" claim elsewhere in this document — it is not aspirational, the interface + at least one real adapter exists for every category. Adding Cloudflare Stream, Twilio, or a new AI vendor means adding one adapter file that satisfies the existing interface and registering it — not restructuring the product.

---

## 4. Complete System Architecture Diagram

```
                                        USERS
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                             │
           Mobile Application (apps/mobile)          Admin Application (apps/admin)
           Expo Router · role-aware single app        Platform Governance only
           Visitor → Member → Leader, same binary      18 governance pages
                    │                                             │
                    └─────────────────────┬─────────────────────┘
                                          │
                          Edge Function API Layer (83 functions)
                          normalized {data,meta} / {error} envelope
                          Bearer JWT + X-Organization-Id + X-Branch-Id
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                Supabase Platform            │
                    │  PostgreSQL (60 migrations, RLS-enforced)   │
                    │  Auth (email + E.164 phone)                 │
                    │  Storage (avatars, branding, media)         │
                    │  Realtime (stream presence / live)          │
                    │  Edge Functions runtime (Deno)               │
                    └─────────────────────┬─────────────────────┘
                                          │
                          External Provider Layer (adapter pattern)
                    ┌───────────┬───────────┬────────────┬───────────┐
                    │           │           │            │
              AI Providers  Streaming   Payment      Media/Storage
              OpenAI /      Providers   Providers    Providers
              Gemini /      Mux         Stripe /     Supabase Storage /
              Anthropic     (adapter)   Paystack     Mux
```

**Structural note not present in the pasted draft:** the Edge Function layer is not a thin passthrough — it is where every authorization decision, idempotency check, and provider-secret boundary lives. Neither app is ever configured with a Supabase service-role key or a raw provider secret; `apps/mobile/.env.example` and `apps/admin/.env.example` both confirm the only client-side configuration is a public functions URL.

---

## 5. Authority & Governance Architecture

This is, correctly, the most critical section — and it is the part of the pasted draft most worth checking against reality, because it's easy to describe an authority model on paper that the schema doesn't actually enforce. In this repository, it does. `supabase/migrations/20260902224340_platform_authority.sql` introduces a **structurally separate** Level-1 authority system — not a role flag on the existing table.

### Layer 1 — Platform Authority (verified, structurally separate)

Platform authority is not "an org role called admin." It is a **separate table set**:

- `platform_roles` — e.g. `super_admin`, `admin` (seeded in the migration)
- `platform_role_permissions` — join table, constrained by a `check` that every permission code must `like 'platform.%'`
- `platform_role_assignments` — grants a `platform_role` to a `profile_id`, independent of any organisation membership

Platform permission codes are namespaced and verified in the migration to include (non-exhaustive): `platform.overview.read`, `platform.organizations.read/manage`, `platform.expressions.read/manage`, `platform.users.read/manage`, `platform.streaming.read/manage`, `platform.ai.read/manage`, `platform.payments.read/manage`, `platform.integrations.read/manage`, `platform.features.read/manage`, `platform.audit.read`, `platform.security.manage`, `platform.roles.read/manage`, `platform.branding.manage`.

**Owns:** platform security, moderation/abuse prevention, global configuration, provider management (streaming/AI/payments infrastructure), feature availability, audit, tenant lifecycle (suspend/restore/archive an organisation or expression).

**Does not own — verified by the giving-boundary migration (`20260904102944_restore_church_owned_giving.sql`, dated the same day as this document):** giving/finance operations. That migration explicitly deactivates `platform.giving.read`/`platform.giving.manage` and rewrites the RLS policies on `giving_campaigns`, `giving_settings`, `giving_purposes`, and `organization_bank_accounts` to require the **church-scoped** `giving.campaigns.manage` capability instead. This is a concrete, dated example of the boundary in Section 6 of your pasted doc ("Does not own: churches, sermons, expressions, livestream content, church giving, ministries") being actively enforced and corrected in the schema, not just asserted in prose. Platform Authority retains ownership of **payment infrastructure** (provider credentials, rails, reconciliation tooling) via `platform.payments.*` — the distinction is infrastructure vs. operation, exactly as your draft states, and it's now the enforced state, not merely the intended one.

### Layer 2 — Organisation Authority (verified)

Church-level governance, scoped by `organization_id` on essentially every domain table. Owns: church profile, members, expressions, ministries/departments, leaders, content, livestream (operationally, not infrastructurally), giving (operationally).

### Layer 3 — Expression Authority (verified, with a terminology caveat you need to know)

**Product terminology is "Expression." Database terminology is "branch."** This is explicit and deliberate in the repo's own handover docs: *"The existing backend contains legacy `branches`, `branch_id` and `X-Branch-Id` terminology. Do not blindly rename those in production. Treat the current branch model as the existing implementation of the product concept Expression."* Every table that scopes to an Expression (content_items, giving_campaigns, follows, etc.) uses a `branch_id`/`expression_id` foreign key against `public.branches`, and every tenant-scoped Edge Function reads the `X-Branch-Id` header. New product/UI code should say "Expression"; new database/API code should not invent a parallel `expressions` table. If a rename is ever justified, it must be a deliberate, backward-compatible migration — not a drive-by fix.

Owns: expression content, expression events, expression members (via branch-scoped membership), expression leaders (`leaders` table has an `expression_id` column).

### Permission resolution is real SQL, not a description

The exact function, verified in `supabase/migrations/20260902225125_platform_lifecycle_enforcement.sql`:

```sql
create or replace function public.has_permission(
  target_organization_id uuid,
  requested_permission text,
  target_branch_id uuid default null
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select requested_permission not like 'platform.%'
    and exists (
      select 1
      from public.memberships m
      join public.organizations o on o.id = m.organization_id
      join public.role_assignments ra
        on ra.membership_id = m.id and ra.organization_id = m.organization_id
      join public.role_permissions rp on rp.role_id = ra.role_id
      join public.permissions p on p.code = rp.permission_code
      where m.profile_id = auth.uid()
        -- (scope/status/branch matching continues)
    )
$$;
```

This is called from RLS policies and from Edge Function authorization checks with the exact signature `(organization_id, 'permission.code', branch_id)`. It is, concretely, the "User + Organisation + Expression + Role + Permission + Scope = Access Decision" formula from your draft — implemented as one auditable SQL function, not scattered `if` statements.

---

## 6. Identity Architecture

### Public Platform and Expression Spaces — authoritative context model

The application has two deliberately separate user contexts. They share identity and
the content model, but they do not share navigation or implicit data access.

#### Public context

Public context is the general City of Transformation platform. It is the default context
at launch, after authentication, and whenever a user leaves an Expression. Its Home,
Discover, Reels, Watch, audio, sermons, livestreams, events, profiles, church information,
and social feed contain only records explicitly classified for public visibility. Public
queries must not become broader merely because the caller is authenticated or belongs to
an Expression. Where practical, public Edge Functions use the anonymous database client
for reads even when a bearer token is present, so RLS proves that the returned rows are
genuinely public.

Unauthenticated users may read public records and public playback that does not require a
member grant. Authentication is required for identity-bearing mutations such as reacting,
commenting, following, saving, joining, posting, or managing content. Authentication does
not itself confer organisation membership, Expression membership, or leadership power.
Clients route a visitor to sign-in before a protected interaction; APIs and RLS still
reject the same interaction when called directly without a valid identity.

#### General Community member publishing policy

General Community is public to read, but ordinary public publishing is not an unrestricted
account capability. An authenticated user may publish ordinary General Community social
posts only when they belong to at least one active Expression in that church. This grants
a **member-social lane**, not ministry publishing authority.

For an ordinary Expression member, a General Community post may contain concise text,
images and short social video only. The validated community-media pipeline currently
limits this lane to 2,200 text characters, four attachments per post, 50 MB per attachment,
and videos of at most three minutes. Standalone audio is excluded from this ordinary
public lane so sermon/audio-ministry material cannot be smuggled into General as a normal
member post.

Members may also reshare an **already-published public Reel** into General Community by
reference. That operation creates a lightweight social post pointing to the canonical
Reel; it does not duplicate the media asset and does not grant `reels.publish`. Private
Expression Reels cannot be shared to General Community or through the external native
share action.

This member-social capability does **not** grant canonical Sermon, Watch/long-video, Reel
publication, livestream broadcasting, or any other ministry-authoritative content type.
Those continue to require their exact capabilities and dedicated publish contracts
(`sermons.*`, `videos.publish`, `reels.publish`, `streams.broadcast`, etc.). A user
with explicit `feed.post` authority is treated as an elevated publisher for social-feed
governance, but long-form/ministry content should still use its canonical content system.

The raw `publish_social_post` RPC is not executable by authenticated app clients. Mobile
publishing goes through `social-feed` → `publish_social_post_with_uploads`, which validates
membership, posting restrictions, media ownership, scope, count, type and duration before
attaching media and publishing the post. General Community queries use the church scope
(`branch_id is null`) so Expression-feed posts are not duplicated into the General feed.

#### Expression context

An Expression is a contained community space backed by the existing `branches` table and
`branch_id`/`X-Branch-Id` compatibility contract. It is not a public-feed category. The
canonical context transition is:

```
Public Platform → My Expressions → Enter Expression → Expression Home
Expression Home → Leave Expression → Public Platform
```

Entering is an explicit client action that persists an `active_expression_id` equivalent
(`branchId` in the current client auth state) only after the backend has returned that
Expression among the user's active memberships. Leaving clears `branchId` immediately,
clears Expression-derived context and permissions, invalidates Expression query keys, and
returns to public navigation. Changing Expression performs the same clear-before-enter
transition so data from Expression A cannot remain visible while Expression B loads.

Expression navigation exists only while an active Expression has been resolved by the
backend. It may expose Expression Home, feed, announcements, members, groups,
departments/units, events, livestreams, Reels, videos, audio, sermons, notifications,
leadership, and permitted administration. On exit, these routes and controls disappear.
Deep-linking directly to an internal route without the exact active membership must result
in a not-a-member/unauthorized state, never an implicit context switch.

#### Membership model and multiple Expressions

Organisation membership and Expression membership are different facts:

- `memberships` represents the authenticated person's relationship to an organisation.
- `expression_memberships` represents membership in one `branches` row and has its own
  active/invited/suspended/left lifecycle.
- one active organisation membership may have zero, one, or many Expression memberships;
  no single-Expression assumption is permitted;
- `role_assignments.branch_id` scopes roles to an Expression. A role assignment never
  substitutes for the underlying active Expression membership;
- authenticated, organisation member, Expression member, and Expression leader/admin are
  four distinct authorization states.

Legacy `memberships.branch_id` remains readable during compatibility migration but is not
the long-term cardinality authority. New membership and access logic uses
`expression_memberships`. Existing branch-anchored membership rows are backfilled into the
new relation before clients depend on it.

#### Invite-code joining and management

Expression joining is invite-code only. The public UI provides **Join an Expression**, not
an unrestricted Expression directory with a Join button. The flow is two-stage:

1. an authenticated caller submits a code to the server for validation;
2. the server returns only safe preview information (Expression name and organisation
   name), never internal UUIDs or member data;
3. the caller confirms;
4. the server revalidates the code in a locked transaction, verifies active organisation
   and Expression state, expiry and usage limits, creates/reactivates organisation and
   Expression memberships, increments usage, and writes audit records;
5. the client refreshes membership context and offers **Enter Expression**.

`expression_invite_codes` stores Expression ownership, creator, a SHA-256 hash of a
cryptographically random code, a non-secret display hint, status, optional expiry,
optional usage limit, usage count, created/revoked timestamps, and revoker. Raw codes are
returned only once when generated and are never stored. Codes disclose no database UUID.
Authorized leaders manage codes through capability checks (`members.invite` at the exact
Expression scope), not role-name comparisons. They can generate, list safe metadata, copy
or externally share the one-time returned code, revoke, and generate replacements. Code
validation and redemption are rate-limited server operations and all generate/revoke/use
events are audited.

#### Content scope is explicit, not inferred from creator

Creator ownership and audience visibility are independent. An Expression may create both
public and internal content. `visibility = 'public'` makes an authorized, published record
eligible for public surfaces even when `expression_id`/`branch_id` identifies its creator.
`visibility = 'branch'` confines it to the exact active Expression. Existing additional
classes retain their meanings: `organization` is organisation-member scope, `group` is an
exact Expression group scope, and `private` is actor/permission-specific.

This rule applies uniformly to posts, Reels, long video, audio, sermons, events, and
livestreams. A public livestream may be created by an Expression and appear publicly; an
Expression livestream uses signed/member playback and stays inside that Expression. The
presence of `branch_id` must never by itself include or exclude a record from a public
surface—the explicit visibility value is authoritative.

#### Query, API, and navigation boundaries

Public routes never send `X-Branch-Id` and call public endpoints or explicit `scope=public`
contracts. Expression routes require an active backend-resolved Expression and send both
`X-Organization-Id` and `X-Branch-Id`; collection queries additionally bind their filters
to that exact branch. Query/resource keys include `public` or the active Expression ID.
Entering, leaving, membership changes, and sign-out invalidate the old scoped resources.
Realtime channels and storage/playback grants follow the same scope and are unsubscribed
before context changes.

An Expression profile visible publicly is descriptive only: public identity and explicitly
public content. It is not the internal Expression environment and must not expose members,
groups, departments, announcements, internal events, permissions, or management actions.

#### Backend and RLS boundary

Every Expression-scoped request is authorized independently of client filtering. The
shared request context validates the bearer identity, active organisation membership,
active `expression_memberships` row for the exact organisation/Expression pair, active
organisation, and active Expression before resolving `membershipId` and `branchId`.
Privileged mutations additionally call `has_permission(organization_id, capability,
branch_id)`. RLS read policies use the same exact active Expression membership predicate;
group/department access additionally requires membership or the relevant scoped
capability. A malicious request that substitutes another `X-Branch-Id`, URL ID, body ID,
realtime channel, or storage path must be denied.

Public RLS policies require published/active state plus explicit public visibility. Public
APIs must not use service-role reads without reproducing those predicates. Expression APIs
reject absent context as `EXPRESSION_REQUIRED`, non-members as
`EXPRESSION_MEMBERSHIP_REQUIRED`, inactive spaces as `EXPRESSION_UNAVAILABLE`, and
insufficient capabilities as `PERMISSION_DENIED`; clients map these separately to sign-in,
not-a-member, unavailable, and unauthorized states rather than a generic network failure.

These boundaries must hold at all five layers—UI, navigation, query, API, and database/RLS.
Hiding a control is never accepted as the security implementation.

Verified flow, matching `backend/architecture.md` and the `memberships`/`role_assignments` schema:

```
User (Supabase Auth — email or E.164 phone)
   │
Profile (public.profiles)
   │
Organisation Membership (public.memberships — organization_id, status)
   │
Expression Assignment (branch_id on the membership/role assignment)
   │
Role Assignment (public.role_assignments — scoped, optionally expiring)
   │
Permission Resolution (public.has_permission(...))
   │
Scoped Access
```

No feature should ask "is this user an admin?" It asks `has_permission(organizationId, 'sermons.create', branchId)`, and the client mirrors that with `hasCapability('sermons.create')`-style helpers that are UX-only (Section 21 restates why the client check is never the real gate).

**A user can hold an account without being an active church member** — this is enforced by keeping Auth identity and `memberships` as separate tables, not a single row. Platform-level identity (Section 5, Layer 1) is separate again, via `platform_role_assignments`.

---

## 7. Permission Architecture

Verified permission catalogue conventions (`public.permissions`, columns `code`, `name`, `description`, `category`):

| Category | Example codes actually present in migrations |
| :--- | :--- |
| Membership | `members.read`, `members.update`, `members.invite` |
| Roles | `roles.read`, `roles.manage`, `roles.assign` |
| Church ops | `events.create`, `events.update`, `attendance.read`, `attendance.manage`, `groups.manage`, `groups.members.manage`, `prayer.moderate`, `volunteers.manage`, `announcements.manage`, `units.manage` |
| Giving | `giving.campaigns.manage`, `giving.finance.read`, `giving.refunds.manage` |
| Streaming | `streams.manage`, `streams.broadcast`, `streams.recordings.manage` |
| Content | `sermons.create`, `sermons.manage`, `sermons.publish`, `posts.create`, `posts.publish`, `reels.create`, `videos.create`, `media.upload`, `feed.post` |
| AI | `ai.use`, `ai.review` |
| Platform (Level 1 only) | `platform.overview.read`, `platform.organizations.manage`, `platform.streaming.manage`, `platform.ai.manage`, `platform.payments.manage`, `platform.audit.read`, `platform.security.manage`, `platform.roles.manage`, `platform.branding.manage`, … |
| Ops/audit | `audit.read`, `reports.read`, `integrations.manage` |

**Resolution formula (implemented, see Section 5):**

```
User + Organisation + Expression(branch) + Role + Permission + Scope = Access Decision
```

**Frontend:** hides unavailable actions using client-side capability helpers derived from `organization-context`'s resolved permission list.
**Backend:** always enforces — every mutating Edge Function checks the relevant permission server-side, and RLS provides a second, independent enforcement layer at the database level. This defense-in-depth (Edge Function check + RLS) is already the pattern; do not remove either layer even if it looks redundant.

---

## 8. Database Architecture

Everything below is a table that exists in the migrations today, organized into the domains your draft specified, with corrections where the real schema is more specific than a generic guess would be.

### Identity Domain

`profiles` · Supabase Auth (`auth.users`, not app-owned) · sessions are Supabase-managed · `identity_badges` (added `20260903143016_identity_badges.sql`) · profile avatar storage (`20260903142433_profile_avatar_storage.sql`) · birthdays on profile (`20260903142222_profile_identity_and_birthdays.sql`).

### Organisation Domain

`organizations` · `branches` (= Expressions, see Section 5) · `memberships` · `roles` · `role_permissions` · `role_assignments` · `permissions` · membership invitations (`membership-invitations` function backs this) · `platform_roles` / `platform_role_permissions` / `platform_role_assignments` (Level-1, structurally separate — see Section 5).

### Content Domain

`content_items` (supertype) · `reels` · `videos` · `sermons` (+ `sermon_series`) · `leaders` (independent entity, decoupled from login accounts — has its own `profile_id` FK, so a leader can be listed without having a user account) · `media_assets` · `media_renditions` · `media_tracks` · `media_thumbnails` · `follows` · `content_reactions` · `content_comments` · `content_bookmarks` · `content_playback_progress` · `content_moderation_reports`.

Enums actually defined: `content_item_type` = `('post','reel','video','sermon','live_stream')` · `content_visibility` = `('public','organization','branch','group','private')` · `publication_status` = `('draft','processing','review','scheduled','published','archived')` · `media_asset_type` = `('video','audio','image')` · `media_processing_state` = `('uploading','uploaded','processing','ready','failed')` · `media_rendition_kind` = `('video_stream','video_download','audio_stream','audio_download','thumbnail','waveform')` · `video_category` = `('documentary','conference','worship','interview','testimony','teaching','programme','highlights','podcast','general')`.

### Event Domain

`events` · `event_registrations` (capacity-aware, waitlisting per `backend/api.md`) · `attendance` (idempotent check-in).

### Streaming Domain

Backed by `20260826100000_production_streaming.sql` and the `_shared/streaming` adapter layer. Live stream records, provider-normalized state, recordings/replays. See Section 13 for the full lifecycle.

### Giving Domain

`giving_campaigns` · `giving_settings` · `giving_purposes` · `organization_bank_accounts` (manual/bank giving) · donation intents/receipts/payment events (`payment-checkout`, `payment-events` functions) — church-scoped per the most recent migration (Section 5).

### Notification Domain

`notifications` · `notification-settings`-backed preference tables (including push device registration) · `notification-dispatch` (worker-secret-authenticated durable job claimer, per `backend/api.md`).

### Platform Domain (not in your original outline, but real and load-bearing)

`platform_roles`, `platform_role_permissions`, `platform_role_assignments`, plus platform feature flags (`20260903004601_platform_feature_flags.sql`), platform audit as **append-only** (`20260903003433_platform_audit_append_only.sql` — worth calling out: ordinary admins, even platform ones, cannot edit audit history, enforced at the schema level), platform secret vault references (`20260903161236_platform_secret_vault.sql` — secret *references*, not raw secrets, in the database).

---

## 9. Content Architecture

Verified, and this is one of the strongest parts of the existing implementation: **`content_items` is a real supertype table**, not a documentation concept.

```sql
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  expression_id uuid references branches(id),      -- "expression" in product language
  group_id uuid references groups(id),
  author_profile_id uuid references profiles(id),
  content_type content_item_type not null,          -- post | reel | video | sermon | live_stream
  visibility content_visibility not null default 'public',
  status publication_status not null default 'draft',
  published_at timestamptz,
  ...
  check (
    (visibility = 'branch' and expression_id is not null) or
    (visibility = 'group' and group_id is not null and expression_id is not null) or
    (visibility in ('public','organization','private'))
  )
);
```

Typed subtypes (`reels`, `videos`) foreign-key back to `content_items` on a **composite key** `(id, organization_id)` — meaning the tenant boundary is enforced at the foreign-key level, not just by convention. `sermons` was retrofitted with `content_item_id`, `audio_asset_id`, `video_asset_id`, and `chapters` columns to join the same supertype pattern.

```
content_items (supertype: id, org, expression, author, type, visibility, status, published_at)
 │
 ├── social_posts / social-feed domain
 ├── reels          (media_asset_id, caption, audio_title/artist, counters)
 ├── videos         (media_asset_id, series_id, category, chapters jsonb, transcript, counters)
 ├── sermons        (preacher, scripture, audio_asset_id, video_asset_id, chapters, series)
 └── live_streams   (provider, status — see Section 13)
```

A sermon is not a video, exactly as your draft insists — it's confirmed at the schema level: `sermons` carries **separate** `audio_asset_id` and `video_asset_id` columns, so a sermon can be audio-only, video-only, or both, and the client renders `Listen` / `Watch` / a toggle based on which asset(s) are actually populated (Section 12, Section 19).

---

## 10. Social Architecture

Verified engagement tables, all targeting `content_items(id)` with strict FK integrity: `content_reactions` (typed reactions), `content_comments` (threaded via `parent_comment_id`, with `is_hidden` soft moderation), `content_bookmarks`, `content_playback_progress` (server-persisted, powers cross-device "Continue Watching"/"Continue Listening"), `content_moderation_reports`.

**Follow ≠ Membership — enforced by a database constraint, not a comment.** The `follows` table:

```sql
create table public.follows (
  profile_id uuid not null references profiles(id),
  organization_id uuid references organizations(id),
  expression_id uuid references branches(id),
  leader_id uuid references leaders(id),
  check (num_nonnulls(organization_id, expression_id, leader_id) = 1),
  unique (profile_id, organization_id),
  unique (profile_id, expression_id),
  unique (profile_id, leader_id)
);
```

The `num_nonnulls(...) = 1` check means a single follow row targets exactly one of an organisation, an expression, or a leader — you cannot construct an ambiguous or multi-target follow row even by accident. Following unlocks a personalized public feed only; it never appears in an authorization check anywhere in the permission system.

---

## 11. Reels Architecture

Verified against `apps/mobile/app/(tabs)/reels.tsx`, `apps/mobile/app/studio/reel.tsx`, and the `reels` table.

- Vertical full-screen player, swipe navigation — reels is a dedicated top-level tab (Section 19).
- Creator identity: `leaders` entity + expression identity, joined through `content_items.author_profile_id` / `expression_id` — never hardcoded per `docs/DEV_HANDOVER/04` ("Do not hardcode `Sanctuary Expression` or other fake source names").
- Engagement: `likes_count`, `comments_count`, `shares_count`, `views_count` are real denormalized counters on the `reels` row, kept in sync by the engagement Edge Function, not client-computed.
- Audio attribution: `audio_title` / `audio_artist` columns exist on `reels` specifically to support the bottom audio badge.
- Creation: authorized via `posts.create`/`reels.create`-class capabilities in Creator Studio (`app/studio/reel.tsx`), or as a clip sourced from a completed live recording (Section 13's "Recording to sermon" pattern applies analogously to reels).
- A recommendation engine is **not yet evidenced in the schema** — treat this as a genuine gap to design, not an oversight to silently work around. If you build one, keep it as a read-time ranking service over existing `content_items`/engagement data rather than a new content system.

---

## 12. Long Video / Watch Architecture

Verified against `apps/mobile/app/(tabs)/watch/`, the `videos` table, and `video_category` enum.

Watch is a deliberately separate content type from Sermon — the enum `video_category` (`documentary | conference | worship | interview | testimony | teaching | programme | highlights | podcast | general`) exists precisely so long-form content that isn't a sermon (a documentary, a conference session, a testimony reel) doesn't get force-fit into the sermon domain, matching your draft's Section 12 and the handover's explicit instruction: *"Do not treat every long-form video as a sermon."*

`videos` supports: `series_id` (grouping into a `sermon_series`-style collection — the same series concept is reused across content types), `chapters` (`jsonb`, validated as an array), `transcript`, and a `slug` unique per organisation (for shareable/canonical URLs). Watch is routed as a non-tab destination reachable from Home/Discover (`href: null` in the tab layout — Section 19), consistent with the handover's instruction to keep it a first-class destination without crowding the 5-tab bar.

---

## 13. Live Streaming Architecture

Verified against `20260826100000_production_streaming.sql`, `_shared/streaming/{types,registry,mux}.ts`, and the `streaming-broadcasts`, `streaming-webhook`, `streaming-recordings`, `stream-access`, `stream-presence`, `live-interactions`, `live-streams` Edge Functions. Third-party only — no in-house video infrastructure is built or planned; this is a design principle already reflected in the actual adapter shape (there is no transcoding code in the repo, only an ingest/webhook/playback-grant integration against Mux).

```
Church Media Leader (streams.broadcast capability, scoped to their Expression)
   │
Mobile App (leadership/media-studio.tsx)
   │
Backend (streaming-broadcasts function)
   │  — checks has_permission(org, 'streams.broadcast', branch)
   │  — resolves provider via streaming/registry.ts
   ▼
Streaming Adapter (streaming/mux.ts today)
   │  — provisions ingest via real Mux RTMPS endpoint (rtmps://global-live.mux.com)
   ▼
Provider (Mux)
   │  — sends signed webhooks (verified via `mux-signature`) to streaming-webhook
   ▼
Viewer (stream-access issues a signed, time-limited playback token via createPlaybackToken)
```

**Normalized internal states** (not raw provider states — the repo's own service-readiness check (`scripts/check-production-services.mjs`) statically verifies these invariants exist in code): `draft → scheduled → provisioning → ready → live → reconnecting → ended → processing → recording_ready → failed → cancelled`. Raw Mux state is stored separately and never leaked directly to the client as the source of truth.

**Provider independence is structural, not aspirational** — `interface StreamingProvider` in `_shared/streaming/types.ts` is the contract; `MuxStreamingProvider` is the only implementation today, but adding Cloudflare Stream means writing a second class against the same interface and registering it in `streaming/registry.ts`. The product/database layer (states, permissions, recordings, sermon-conversion) does not change.

**Database stores:** stream status, metadata, ownership (`organization_id`/`expression_id`), and permission scope — never raw provider secrets. Stream keys, RTMP/SRT ingest details, and webhook signing secrets live only in deployment-configured secrets (`STREAMING_MUX_PRIMARY`, `STREAMING_MUX_WEBHOOK_PRIMARY`, `STREAMING_MUX_SIGNING_PRIMARY` — see Section 17/23), never in a client bundle, and are only ever handed to the authorized operator at the moment of provisioning.

**Recording → Sermon is a deliberate, non-automatic workflow**, matching your draft's philosophy exactly: `Recording Ready → Sermon Draft → Metadata/Review → user with sermons.publish → Published`. Operating a livestream does not, by itself, grant sermon-publishing authority — these are different permission codes (`streams.broadcast` vs. `sermons.publish`).

---

## 14. AI Architecture

Verified against `_shared/ai/{types,registry,router,openai,gemini,anthropic}.ts` and the `ai-gateway`/`ai-review` Edge Functions, plus `20260826110000_ai_gateway.sql` and the later `ai_provider_registry`/`ai_usage_runtime` migrations.

```
Mobile / Creator Studio
   │
AI Gateway (ai-gateway function — requires `ai.use`)
   │
Capability Router (_shared/ai/router.ts — routes by requested capability, with fallback_model_ids)
   │
Provider Adapter (interface AiProvider — _shared/ai/types.ts)
   ├── OpenAiProvider
   ├── GeminiProvider
   └── AnthropicProvider
   │
ai_content_drafts (review_status = 'draft')
   │
Human-in-the-loop review (ai-review function — requires `ai.review`)
   │
Published content (only after explicit approval)
```

AI-generated content — transcripts, chapter suggestions, scripture extraction, study-note drafts — lands in a `draft` review state and requires a human with `ai.review` to approve it before it can affect public content. This is enforced by the domain model (a draft row, a review status, a separate approval action), not by a UI convention that could be bypassed by calling the API directly. Ordinary church staff never see or manage raw provider API keys; those are platform-managed secrets (`AI_OPENAI_PRIMARY`, `AI_GEMINI_PRIMARY`, `AI_ANTHROPIC_PRIMARY`) surfaced through `platform-ai` in the admin app, not through church-facing screens.

---

## 15. Giving Architecture

**Corrected against the most recent migration in the repository** (`20260904102944_restore_church_owned_giving.sql`, dated the same day this document was produced — this is the freshest, most authoritative statement of the intended model, and it matches your draft's stated ownership split precisely):

```
Platform Authority
   │  owns: payment provider infrastructure, credentials, rails, reconciliation tooling
   │  (platform.payments.read / platform.payments.manage — still active)
   ▼
Church (Organisation)
   │  owns: giving CAMPAIGNS, giving SETTINGS, giving PURPOSES, bank transfer destinations
   │  (giving.campaigns.manage — church-scoped, exact org/Expression grant)
   ▼
Expression (optional finer scope)
   │  the same giving.campaigns.manage permission can be granted at Expression scope
   ▼
Giving Destination (a specific campaign/purpose/account)
```

The corrective migration explicitly **removed** `platform.giving.read`/`platform.giving.manage` from platform roles and rewrote RLS on `giving_campaigns`, `giving_settings`, `giving_purposes`, and `organization_bank_accounts` to require church-scoped `giving.campaigns.manage` instead. In other words: an earlier iteration of this schema had drifted toward platform-operated giving, and it was deliberately corrected back to church-owned giving — Platform Authority is not the church treasurer, exactly as Section 3 of your draft (and `docs/DEV_HANDOVER/03`) insists. **Payment success is never trusted from a client callback** — `payment-events` only finalizes a donation from a verified, signed provider event (Stripe/Paystack adapters in `_shared/payments/`), consistent with the idempotency rules in Section 8 of the backend handover.

---

## 16. Notification Architecture

Verified: `notifications`, `notification-settings` (including push device registration/removal), and `notification-dispatch` (a **worker-secret-authenticated** durable job claimer — i.e. notification delivery is a background job queue with retries, not a synchronous side effect of the triggering action). This matches your draft's "event-driven design" instruction concretely: dispatch is decoupled from the action that generated it, with `NOTIFICATION_WORKER_SECRET` gating who can claim/acknowledge jobs. Do not hardcode notification copy/triggers directly into feature Edge Functions in a way that bypasses this dispatch/preference layer — route new notification-worthy events through it.

---

## 17. Storage Architecture

Verified via `_shared/media/{types,registry,internal,mux}.ts` and storage-related migrations: `20260903142433_profile_avatar_storage.sql`, `20260903173953_public_community_media_storage.sql`, `20260903185746_content_media_storage.sql`, `20260903182908_social_media_signed_uploads.sql`.

Buckets in use (by migration name, confirming your listed categories are all real): profile/avatar images, community/social post media, content/sermon/reel/video media, church branding assets (referenced by `branding` function + `BrandingAppearance` admin page).

**Rules, verified as implemented, not just stated:**
- Signed, short-lived upload/access grants — `20260903182908_social_media_signed_uploads.sql` exists specifically to move social media uploads onto signed URLs.
- Private-by-default with ownership validation — enforced through the same RLS + `has_permission` pattern as every other domain, applied to storage-adjacent tables (`media_assets` carries `organization_id` and is subject to the same tenant RLS).

---

## 18. Admin Dashboard Architecture

Verified against the actual 18 pages in `apps/admin/src/pages/`. This is a **Platform Governance dashboard**, not a church management dashboard — and the page list itself proves it; there is no "create sermon," "manage members," or "schedule service" page anywhere in `apps/admin`.

| Section (your draft) | Actual implemented page |
| :--- | :--- |
| Overview | `Dashboard.tsx`, `PlatformOverview.tsx` |
| Organisations | `OrganizationsGovernance.tsx` |
| Users | `UserGovernance.tsx`, `Members.tsx` |
| Expressions | `ExpressionsGovernance.tsx`, `ExpressionCreators.tsx` |
| Security | `AuditSecurity.tsx` |
| Services | `StreamingInfrastructure.tsx`, `AiInfrastructure.tsx`, `PaymentInfrastructure.tsx`, `ProviderCredentials.tsx`, `IntegrationsJobs.tsx` |
| Branding | `BrandingAppearance.tsx` |
| Feature Controls | `FeatureFlags.tsx` |
| Audit | `AuditSecurity.tsx` (shared with Security) |
| — (not in your draft, but present) | `GivingConfiguration.tsx` (payment **infrastructure** config, not campaign management — consistent with Section 15), `PublicDirectory.tsx`, `AdminInvitations.tsx`, `Operations.tsx` |

**Not:** a church management dashboard — confirmed by absence, and explicitly stated as a non-goal in `docs/DEV_HANDOVER/04`: *"Platform Admin does not routinely: create Sunday livestreams, publish expression sermons, manage local prayer triage, create local groups/events/departments, create local giving campaigns."*

---

## 19. Mobile UI Architecture

The UI is the product — and this section is where the pasted draft is least specific and the real repo is most concrete. Use the values below verbatim; they already exist in `apps/mobile/src/theme/tokens.ts` and are consumed through the theme provider, not hardcoded per-screen.

### Brand tokens (verified, actual hex values)

```
Navy scale:  950 #061426 · 900 #091B33 · 800 #0D294B · 700 #123A66 · 600 #18528B
Blue accent: 500 #2F6FED · 400 #5C8FF5
White:       #FFFFFF
```

**Light mode:** background `#F7F9FC`, surface `#FFFFFF`, primary text `#0B1628`, interactive `#2F6FED`, live/destructive `#E5484D`, success `#16A36A`, warning `#E9A23B`.
**Dark mode:** background `#07111F`, surface `#0C1929`, primary text `#F8FAFC`, border `#21344B` — **dark navy, not brown/black.** Light, Dark, and System theme modes are all implemented (`theme/provider.tsx`).

The former Brown/Gold palette is explicitly retired per `docs/DEV_HANDOVER/05`: *"The old Brown/Gold 'luxury' mobile design is obsolete and must not return."* If you find any screen still using warm gold/brown tones, that is legacy drift to fix, not a design option to preserve.

### Navigation (verified, exact file: `app/(tabs)/_layout.tsx`)

Five, and only five, visible bottom tabs: **Home, Discover, Reels, Community, Profile.** `live` and `watch` are registered as routable children with `options={{ href: null }}` — meaning they are real, working routes reachable from Home/Discover/deep-links, deliberately excluded from the tab bar to avoid the "six cramped tabs" problem your draft's design inspiration (Instagram/YouTube/Spotify/X) also avoids. Do not add a sixth permanent tab without a deliberate UX review — this is an explicit instruction in the handover, not an accident of the current build.

### Design inspiration vs. avoid — both verified as lived rules, not aspirations

**Inspiration (Instagram / YouTube / Spotify / X):** vertical Reels swipe, long-form Watch with chapters, audio player with speed/skip controls, threaded social replies — all present in the route tree and schema (Sections 11, 12, 10).

**Avoid — and this is enforced by an explicit "Static-data rule" in `docs/DEV_HANDOVER/05`,** not just good taste: no fabricated business data anywhere in the client (church name, schedule, preacher, mission/vision/history, member QR pass, viewer counts, giving figures, live status — if the backend doesn't have it, show an honest empty state, e.g. *"No upcoming live services have been scheduled,"* never a invented Sunday time). No emoji as primary navigation icons (one shared `Icon` primitive is used instead). No dashboard-card-of-equal-weight Home screen. No AI-card layout excess.

---

## 20. Error Handling Standard

Verified pattern in `backend/api.md`: every Edge Function returns one of exactly two envelope shapes.

```json
{ "data": {}, "meta": { "requestId": "..." } }
{ "error": { "code": "...", "message": "...", "requestId": "..." } }
```

Never expose to the end user: `API_KEY_MISSING`, `WEBHOOK_FAILED`, `PROVIDER_ERROR`, `DATABASE_ERROR`, `RLS_DENIED`, or any other internal `error.code`. The client maps these to a generic, calm message — *"This feature is temporarily unavailable. Please try again later."* — while the real `code` and `requestId` are preserved in logs/error reporting for diagnosis. **A concrete production incident already validated why this matters**: `docs/WHITE_SCREEN_FINDINGS.md` documents that swallowed/blocking errors (a render blocked on a branding fetch with no timeout, no root error boundary) produced a blank white screen in production rather than a recoverable error state — see Section 21.

---

## 21. Security Requirements

All items in your draft are mandatory and are, at minimum, structurally present in this repo — treat verification of each, not re-implementation, as the task:

- **RLS** — present on every tenant-scoped table via `has_permission(...)`-driven policies; the giving-ownership correction in Section 15 is a live example of RLS being actively maintained.
- **Server permission checks** — every mutating Edge Function checks the relevant capability server-side in addition to RLS (defense in depth — do not remove either layer).
- **Audit logging** — `audit-log` function + `20260903003433_platform_audit_append_only.sql` (audit is append-only even for platform admins).
- **Rate limiting** — `_shared/rate-limit.ts`, backed by `RATE_LIMIT_PEPPER`.
- **Input validation** — `_shared/validation.ts`, used across functions.
- **Secure secrets** — never in client bundles; `platform-secrets` admin function + `20260903161236_platform_secret_vault.sql` store secret *references*, and real values live only in Supabase's deployment-configured secrets.
- **Access control** — the full Section 5/7 permission model.

**Known, already-fixed-in-direction production bug class (learn from this, don't repeat it):** `docs/WHITE_SCREEN_FINDINGS.md` names five confirmed root causes of a production blank-screen failure:
1. Missing `SafeAreaProvider` at the app root, crashing `useSafeAreaInsets()` calls before first paint.
2. `app/_layout.tsx` returning `null` until a remote branding fetch completed — a slow/CORS-blocked branding call blocked the entire app shell.
3. No root error boundary — any uncaught render error fell through to a blank screen.
4. A hardcoded Supabase Functions URL fallback in the API client, masking missing deployment configuration.
5. No default request timeout, so bootstrap/action calls could hang indefinitely.

The prescribed fix direction (per that same doc) is the standing production rule for the whole app, not just a one-time patch: wrap the app in `SafeAreaProvider`; never block the React tree on remote I/O; keep the native splash offline-safe; add a root Expo Router error boundary and not-found screen; require `EXPO_PUBLIC_API_URL` at deploy time rather than shipping a project-specific fallback; bound every API call with a timeout.

---

## 22. Development Rules

Before adding a feature, the repo's own handover pack already asks nearly this exact checklist (`docs/DEV_HANDOVER/00` and `02`). Answer all six before writing code, and prefer discovering an existing answer over inventing a new one:

1. **What database supports this?** — search `supabase/migrations/` and `packages/types/src/` first; 60 migrations already exist across every domain in Section 8.
2. **What permission controls this?** — search `public.permissions` seed inserts across migrations for an existing code before inventing a new one; the catalogue in Section 7 is not exhaustive.
3. **What API handles this?** — search the 83 functions in `supabase/functions/` (list in Section 3's provider table plus `backend/api.md`'s endpoint tables) before creating a new function; extend an existing one where the domain already exists.
4. **What happens if it fails?** — must map to the `{error:{code,message,requestId}}` envelope (Section 20) and a calm, non-leaking client message.
5. **What does the user see?** — must satisfy the "UI definition of done" (Section 23) — no fabricated data, correct light/dark tokens, correct capability gate.
6. **How is it audited?** — sensitive mutations (role grants, provider config, refunds, suspensions, emergency stream termination) must write to the append-only audit log.

---

## 23. Production Readiness Checklist

This section merges your draft's checklist with the concrete, already-written audit checklist in `docs/DEV_HANDOVER/06_PRODUCTION_TESTING_DEPLOYMENT_AND_NEXT_STEPS.md` — use the latter as the working document; what follows is the condensed form.

### Repository-level checks that already exist — run these first

```bash
npm run foundation:check   # verifies migration set structurally present
npm run api:check          # verifies Edge Function/endpoint security invariants
npm run apps:check
npm run services:check     # verifies streaming + AI provider adapter invariants exist in code
npm run admin:typecheck && npm run admin:build
npm run mobile:typecheck && npm run mobile:build
npm run db:verify          # requires local Docker + Supabase CLI: reset, lint, test
```

**Important, and explicitly called out in the repo's own docs:** *"A passing structural/type check does not by itself prove deployed production readiness."* `services:check`, for example, statically greps for the presence of `interface StreamingProvider`, a real Mux RTMPS URL, webhook signature verification, etc. — it proves the code exists and is shaped correctly, not that a live Mux account with real secrets is attached and working end-to-end.

### Backend
- ✓ Migrations present and structurally checked locally — **verify separately** that all 60 are actually applied to the linked remote Supabase project (`supabase db push` / `supabase migration list`), since local presence and remote application are different facts.
- ✓ Permissions tested — verify with distinct test users per role (ordinary member, media, finance, pastoral, expression admin, org admin, platform admin) proving both UI visibility *and* direct backend denial for out-of-scope actions.
- ✓ APIs stable — confirm the required secrets in Section 17/21 (`SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, `RATE_LIMIT_PEPPER`, `PASSWORD_RECOVERY_REDIRECT_URL`, `NOTIFICATION_WORKER_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `WORKFLOW_WORKER_SECRET`, plus provider secrets `STREAMING_MUX_*`, `AI_OPENAI_PRIMARY`, `AI_GEMINI_PRIMARY`, `AI_ANTHROPIC_PRIMARY`) are actually set in the deployed environment, not just documented.

### Mobile
- ✓ No white screens — re-verify the five specific fixes in Section 21 are in place and haven't regressed.
- ✓ No crashes, all states handled — loading/empty/error per screen, per the "UI definition of done" already codified in `docs/DEV_HANDOVER/05` and `06`.
- ✓ Cross-tenant isolation spot-checked from the client, not just assumed from RLS.

### Admin
- ✓ Governance boundaries correct — re-confirm no church-operational feature (create sermon, manage members, schedule service, create giving campaign) has crept into `apps/admin`; Section 18/15 give you the exact boundary and its recent correction.
- ✓ No technical leakage — provider error codes, RLS denials, etc. must not surface raw to platform-admin users either, beyond what their role legitimately needs (Section 20).

### Security
- ✓ Access tested — the specific isolation tests already enumerated in `docs/DEV_HANDOVER/02` and `06` (Org A cannot read Org B; Expression A user cannot manage Expression B without scope; Finance role cannot operate streaming unless separately granted; Media role cannot read finance unless separately granted; visitor cannot reach member/private content; search does not leak private content).
- ✓ Audit verified — confirm sensitive actions (role grants/revokes, provider config changes, suspensions, refunds, emergency stream termination) actually write audit rows, and that the audit table remains genuinely append-only under test.

**Final instruction, carried forward from the repo's own handover pack, and the single most important sentence in this document:** *You are inheriting an advanced, partially completed production platform. Do not erase its history. Do not repeat previously corrected mistakes. Verify reality, preserve valid foundations, and complete the system with production discipline.*
