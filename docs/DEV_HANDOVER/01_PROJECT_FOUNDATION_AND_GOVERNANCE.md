# 01 — Project Foundation and Governance

## Project identity

This repository is the Church Digital Platform / Global Church Digital Operating System. It is independent from SKIMA and must remain isolated from SKIMA repositories, databases, secrets, provider accounts, branding and business logic.

The project is already substantially built. The correct inheritance strategy is:

**inspect → understand → preserve → verify → repair → complete → production-harden**.

Do not restart valid working systems simply because another implementation style is preferred.

## Product vision

The platform combines church operations with a modern consumer media/community experience.

Church operations include:

- organisations
- expressions
- membership
- roles and permissions
- departments / ministries / groups
- events and attendance
- volunteers
- announcements and notifications
- conversations
- prayer and pastoral workflows
- giving and finance

Consumer/media includes:

- public discovery
- social posts
- Reels
- long-form Watch video
- sermons
- audio
- livestreaming
- recordings
- series / playlists / collections
- comments and threaded replies
- reactions
- bookmarks
- follows
- playback progress
- search

Platform infrastructure includes:

- Platform Admin
- streaming provider registry
- AI provider registry
- payment infrastructure
- jobs / workflows
- webhooks
- feature flags
- audit / security
- observability / moderation

This is not merely a CMS or internal church database with a feed attached.

## Production-first philosophy

This is not a prototype, mockup or demonstration.

A feature is not complete because a screen renders or TypeScript compiles. Production completion requires the real backend, authorization, correct tenant scope, error/empty/loading states, real provider integration where relevant, observability, security, and end-to-end verification.

Never present fake values as real church data.

## Final authority hierarchy

The canonical governance model is:

1. **Platform Authority**
2. **Church Organisations**
3. **Expressions**
4. **Departments / Ministries / Groups / Teams**
5. **Members / Visitors**

### Level 1 — Platform Authority

Typical platform roles may include:

- Platform Super Admin
- Platform Admin
- Platform Operations
- Platform Security
- Platform Moderation
- Platform Support

Platform Authority governs the software ecosystem.

It manages areas such as:

- global tenant lifecycle
- organisation/expression governance
- bans and suspensions
- abuse and safety
- platform feature flags
- global branding infrastructure
- streaming provider infrastructure
- AI provider infrastructure
- payment provider infrastructure
- integration health
- webhooks
- jobs
- audit
- security
- quotas
- platform telemetry
- incidents

### Platform Admin is NOT Church Admin

This was a major correction during development and must never regress.

Platform Admin does **not** ordinarily:

- create an expression's Sunday livestream
- schedule a church service
- publish a church sermon
- write local devotionals
- manage local groups
- triage normal private prayer requests
- assign local ministry workers
- create local events
- create local giving campaigns
- act as a church treasurer
- send routine expression announcements

Those responsibilities belong to authorised users inside the relevant organisation/expression.

Platform Admin may intervene for platform safety, compliance, abuse, security, support or emergency operations, but that is different from routine church operation.

### Level 2 — Church Organisations

An organisation is an independent church entity inside the platform.

The architecture must support many organisations; never hardcode a single church.

Possible organisation-level roles include:

- Senior Pastor
- Organisation Administrator
- Organisation Finance Lead
- Organisation Media Lead
- Organisation Communications Lead
- Organisation Membership Lead
- Organisation Pastoral Lead

Organisation-level authority may legitimately span multiple expressions belonging to that organisation.

### Level 3 — Expressions

The canonical product term is **Expression**.

An expression may correspond to a branch, campus, local assembly or congregation.

New product/domain code should prefer `expression` / `expression_id` terminology.

The existing backend contains legacy `branches`, `branch_id` and `X-Branch-Id` terminology. Do not blindly rename those in production. Treat the current branch model as the existing implementation of the product concept Expression unless/until a safe compatibility migration is intentionally designed.

Do not create a second duplicate expressions table merely to improve naming.

### Level 4 — Departments, Ministries, Groups and Teams

These structures are organisation/expression-owned and database-driven.

Do not hardcode Choir, Youth, Media, Hospitality, Protocol, Evangelism, etc. Those are examples only.

Churches must be able to create their own structures and assign leaders/members according to scoped permissions.

### Level 5 — Members and Visitors

Members and visitors use the church/media experience according to identity, membership, feature availability and scoped capabilities.

## Authentication identity is not membership

Keep platform identity separate from church affiliation.

Conceptually:

`Auth Identity → Profile → Organisation Membership → Expression Assignment → Optional Department/Ministry/Group Membership`

A user may have an account without being an active church member.

## Follow is not membership

This is a core invariant.

A Follow is a consumer preference to receive public updates from an organisation, expression or leader.

Membership is formal affiliation that can unlock private member experiences.

Never use Follow as an authorization boundary.

## Public title is not authorization

Displaying `Lead Pastor`, `Media Lead`, `Finance Officer`, etc. publicly does not grant backend permissions.

Authorization comes only from database-backed permissions/capabilities and their scopes.

## RBAC and capability architecture

Do not use a simplistic `if role === 'admin'` authorization model.

Capabilities may include areas such as:

- members.read / invite / update
- roles.read / manage / assign
- events.create / update
- attendance.read / manage
- groups.manage
- prayer.moderate
- announcements.manage
- giving.campaigns.manage
- giving.finance.read
- giving.refunds.manage
- streams.manage
- streams.broadcast
- streams.recordings.manage
- sermons.create / manage / publish
- posts.create / publish
- ai.use / ai.review
- integrations.manage
- reports.read
- audit.read

Always use the actual database permission catalogue rather than inventing inconsistent codes in frontend components.

## Authorization invariant

Protected actions conceptually require:

**Actor + Capability + Tenant/Resource Scope + Resource Ownership**.

A user permitted to operate Expression A's livestream must not automatically operate Expression B's stream.

A leader in one organisation must not access another organisation's private data.

## Frontend checks are UX only

`hasCapability(...)` and similar helpers determine navigation and presentation.

They are not security boundaries.

Backend authorization and RLS must still reject unauthorized requests.

## Platform Super Admin privacy boundary

Do not implement Platform Super Admin as automatic access to every confidential church record.

Sensitive pastoral areas such as counselling notes, private prayer requests and confidential member notes should have explicit privileged pathways. Exceptional platform-level access, if supported, should be deliberate and audited.

## Visibility model

Content can conceptually be:

- public
- organisation
- expression/branch
- group
- private

Backend policies must enforce these scopes. Client filtering alone is insufficient.

## Source-of-truth priority

When deciding what to preserve:

1. production security and data integrity
2. this latest handover
3. current working implementation
4. older documentation

Older docs contain some superseded decisions, especially around mobile visual design and earlier admin-role assumptions. Do not treat every old sentence as current product direction.