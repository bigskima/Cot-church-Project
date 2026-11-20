# Church Digital Platform — New Developer Handover

This folder is the authoritative developer handover for the current production-oriented Church Digital Platform.

## Read order

Read every file in this folder before making architectural changes:

1. `01_PROJECT_FOUNDATION_AND_GOVERNANCE.md`
2. `02_BACKEND_DATABASE_SECURITY_AND_APIS.md`
3. `03_CONTENT_MEDIA_LIVESTREAM_AI_AND_FINANCE.md`
4. `04_PLATFORM_ADMIN_AND_MOBILE_APPLICATIONS.md`
5. `05_MOBILE_UI_UX_BRAND_AND_PRODUCT_RULES.md`
6. `06_PRODUCTION_TESTING_DEPLOYMENT_AND_NEXT_STEPS.md`

Then inspect these existing repository documents and code:

- `README.md`
- `backend/roadmap.md`
- `backend/api.md`
- `docs/FULLARCTECT.MD`
- `supabase/migrations/`
- `supabase/functions/`
- `apps/admin/`
- `apps/mobile/`
- `packages/`
- `scripts/`

## Priority rule

When older documentation conflicts with this handover, **this handover is the latest product/architecture directive**. Preserve valid existing code, but migrate any obsolete implementation safely rather than blindly keeping it.

## Non-negotiables

- This is a production build, not a prototype.
- Continue from the existing repository; do not restart the project.
- This project is completely separate from SKIMA.
- Platform Admin governs the platform; it does not routinely operate churches/expressions.
- Church operations are handled by scoped organisation/expression roles.
- Use backend-enforced RBAC/RLS; frontend capability checks are UX only.
- Streaming, AI, payments and media remain provider-abstracted.
- Do not fabricate business data in the UI.
- The current mobile brand direction is **dark navy / dark blue + white**, with light, dark and system themes.
- The old Brown/Gold mobile design is obsolete.
- Mobile UI is now a first-class product priority, but do not replace real backend functionality with mocks.
- Use real APIs, real permissions, real data, real provider states and real production error handling.

## First task for the inheriting developer

Before adding new features, produce an audit covering:

- repository/build status
- local vs remote Supabase schema/migrations
- deployed Edge Functions
- required environment/secrets readiness
- Platform Admin modules that work end-to-end
- mobile routes that are production-ready / incomplete / visually incomplete / static/fake / broken
- streaming, AI, payment and communication provider readiness
- RLS and cross-tenant security test status
- exact next production priorities

Do not redesign the architecture again before understanding what is already implemented.