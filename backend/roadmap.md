# Four-Phase Delivery Program

This is the single delivery structure for the Global Church Digital Operating System. Domains inside a phase are built as connected platform capabilities, not treated as independent projects.

## Phase 1 — Platform and Security Core

Architecture, PostgreSQL tenancy, Edge API runtime, validation, authentication, identity, organizations, branches/expressions, membership, invitations, dynamic RBAC, audit, shared contracts, security controls, and foundational tests.

## Phase 2 — Church Operations and Engagement

Events, recurring occurrences, registration, attendance, departments, ministries, groups, volunteers, schedules, prayer workflows, announcements, notification inbox, email/SMS/push delivery, messaging, audience resolution, preferences, and engagement workflows.

## Phase 3 — Finance, Workflows, and Intelligence

Giving campaigns, donations, provider-neutral payments, webhooks, refunds, receipts, reconciliation, domain events, durable outbox processing, scheduled workflows, reports, analytics, exports, and external integrations.

## Phase 4 — Applications and Production

Expo mobile application with role-aware Leadership Hub, Platform Governance Administration web platform, offline synchronization, device push experience, accessibility, end-to-end testing, observability, CI/CD, infrastructure, performance, retention, backup/restore, disaster recovery, and production hardening.

## Completion rule

A phase is complete only when its database constraints, RLS, transactional functions, Edge APIs, shared types, automated tests, operational documentation, and deployment controls are in place. Client experiences are completed in Phase 4 against these stable APIs. A passing structural check alone is not phase completion.

### Current status

Phase 1-3 backend scopes are implemented, including verified-contact invitations, endpoint rate limiting, idempotency storage, tenant security, RBAC, audit, API contracts, provider-neutral finance, receipts, refunds, reconciliation, durable domain workflows, analytics dashboards, external integration connections, live and recorded services, provider adapters for streaming (Mux) and AI (OpenAI, Gemini, Anthropic), and public/organization/expression social platform. Applications are undergoing full production role-aware and governance alignment.
