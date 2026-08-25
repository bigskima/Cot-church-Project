# Church Platform

Backend-first foundation for a global church digital operating system.

This repository contains the foundation architecture, Supabase migrations, security model, and application structure. The implemented tenancy layer separates authenticated identities from organization memberships, supports branch hierarchies, and provides database-driven organization and branch-scoped RBAC.

## Foundation checks

```bash
npm run foundation:check
```

The Edge Function gateway and endpoint security invariants can be checked with:

```bash
npm run api:check
```

For a complete local database verification (Docker and the Supabase CLI are required), run `npm run db:verify`.

Implemented Edge Function routes, authentication requirements, tenant headers, and runtime configuration are documented in [`backend/api.md`](backend/api.md).
