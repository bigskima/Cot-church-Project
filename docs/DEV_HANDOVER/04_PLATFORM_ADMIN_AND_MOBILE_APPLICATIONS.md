# 04 — Platform Admin and Mobile Applications

## Application boundaries

The repository has two principal applications:

- `apps/admin` — Platform Governance & Infrastructure Control Plane
- `apps/mobile` — Expo/React Native church/member/leader application, also targeting web

These are different products with different authority models.

## Platform Admin — purpose

`apps/admin` exists to govern the platform ecosystem, not to act as the operational dashboard for every church.

The current correct direction includes areas such as:

- Platform Overview / Telemetry
- Church Organisations
- Expressions
- Global Identities / User Governance
- Branding & Identity
- Feature Flags
- Streaming Infrastructure
- AI Infrastructure
- Payment Infrastructure
- Integrations / Jobs / Webhooks
- Audit & Security

Preserve this control-plane orientation.

## Platform Admin may do

Examples:

- inspect tenant lifecycle/status
- approve/suspend/restore tenants where product policy requires
- inspect expression status
- ban/suspend/restore platform accounts
- investigate abuse/security incidents
- configure global/provider infrastructure
- manage feature flags/quotas
- inspect jobs/webhooks
- inspect platform/provider health
- enforce policy
- terminate abusive/unsafe streams in exceptional cases
- review platform audit/security information

## Platform Admin must not become Church Admin

Do not add normal church operational modules into Platform Admin simply because the backend supports them.

Platform Admin does not routinely:

- create Sunday livestreams
- publish expression sermons
- manage local prayer triage
- create local groups
- manage ordinary church members as church administrators
- create local events
- manage local departments
- create local giving campaigns

Those functions belong in scoped organisation/expression role experiences.

## Platform Admin data/privacy

Platform-level authority does not imply casual access to all confidential church content. Pastoral/counselling/private prayer data should remain explicitly protected.

## Platform Admin visual work

The admin application is substantially built but still requires ongoing functional, permission, responsive and visual verification.

Do not prioritize a wholesale admin rewrite unless testing proves it necessary. Preserve the correct governance boundary first.

## Mobile application — purpose

`apps/mobile` is the primary church-facing product.

It serves:

- visitors
- authenticated users
- members
- expression members
- leaders
- pastors
- media teams
- finance staff
- pastoral/prayer staff
- event coordinators
- group/department leaders

The same app becomes role-aware based on capabilities and scope; do not create a separate native app for every role.

## Visitor experience

Visitors may access approved public areas such as:

- Home
- Discover
- public livestreams
- sermons
- Watch
- Reels
- public community content
- public expressions
- public events
- public leaders/church story where published

When an action requires authentication, show a deliberate sign-in gate. Do not silently fail.

## Member experience

Authenticated/member users may additionally receive, according to configuration and permissions:

- expression-specific feed/context
- private member content
- groups
- event registration
- giving history
- prayer requests
- notifications
- saved content
- playback progress
- membership-specific features

## Leader experience

Leadership is not a separate global admin product.

The mobile app exposes additional scoped tools according to capabilities.

A Leadership Hub may route to modules such as:

- Media Studio
- Sermons
- Events
- Members
- Groups
- Attendance
- Pastoral Care
- Prayer
- Giving
- Communications
- Expression Management

Only show modules the current user is authorized to access.

Do not use `permissions.length > 0` as equivalent to leader status. Check relevant capabilities.

## Mobile routing/navigation

The latest preferred bottom-tab structure is intentionally limited to five visible primary destinations:

- Home
- Discover
- Reels
- Community
- Profile

Live remains accessible through Home, Discover, header/live actions, live hero and deep links/notifications rather than cramming six permanent tabs into narrow screens.

Do not reintroduce six cramped tabs without a deliberate UX review.

## Live navigation

Although Live is not necessarily visible as a permanent bottom tab, it is a first-class product area and must remain easy to reach whenever a stream is live/scheduled.

## Home experience

Home should feel like a consumer media/community product, not an admin dashboard.

It should answer:

- which church/expression context am I in?
- is anything live?
- what should I watch/listen to?
- what is new?
- what is happening in community?
- what is upcoming?

Potential real sections:

- live/next stream
- Watch/sermon content
- Reels
- community posts
- events
- continue watching/listening

Optional empty sections may disappear. Never fabricate content to fill the page.

## Discover

Discover is the broad exploration/search hub.

It may include:

- sermons
- series/collections
- Watch videos
- Reels
- events
- expressions
- public leaders
- church story/heritage
- public resources

As datasets grow, prefer server-side search/pagination over downloading everything and filtering only in memory.

## Live UX

Live should be media-first and support real backend/provider state.

Primary areas:

- Live Now
- Upcoming
- Replays

Never hardcode service times when no backend schedule exists.

Live detail/player should represent states such as scheduled, provisioning, live, reconnecting, ended, processing, replay ready and failed.

## Reels UX

Reels should be immersive vertical video with real creator/expression attribution, engagement and lifecycle handling.

Do not hardcode `Sanctuary Expression` or other fake source names.

Only active/adjacent media should be prepared to avoid unnecessary playback/resource load.

## Watch UX

Watch is long-form media and should have high-quality video playback, chapters, progress, description, related content, collections and engagement as supported.

Do not treat every long-form video as a sermon.

## Sermon UX

Sermon presentation adapts to actual media:

- Listen for audio-only
- Watch for video-only
- Watch/Listen toggle for dual-format

Show real preacher, scripture, series, date, chapters, transcript and related content when available. Omit missing optional data instead of inventing it.

## Community UX

Community should behave like a modern social feed, not a dashboard grid.

Support appropriate author/expression identity, content, media, reactions, replies/comments, timestamps, sharing and moderation/reporting.

## Profile

Profile should use real account/church context and can group areas such as:

- profile identity
- My Church / Expression
- saved content
- Giving
- Prayer
- Notifications
- Appearance
- account/security
- Leadership Hub when authorized
- sign out

Remove fake member passes or QR simulations unless backed by a real secure credential/check-in implementation.

## Notifications

If notification backend functionality exists, expose a proper inbox/notification centre rather than leaving dead `route: null` rows.

Notification entries should support real type, read state, timestamp and deep link/action where relevant.

## Creator/Ministry Studio

Studio access is capability-gated.

It may support:

- create post
- upload Reel
- upload Watch video
- create/manage sermons
- drafts
- media processing queue
- publishing
- moderation/analytics where authorised

Do not expose Studio universally.

## AI Assistant

There is a dedicated assistant capability/route in the product direction. AI entry points should route to the actual Assistant rather than unrelated screens.

The Assistant UI should represent real provider/API state, loading/streaming, failure and retry. Do not synthesize fake AI responses client-side.

## Context switching

Users may belong to multiple organisations/expressions.

If context switching is exposed, changing context must correctly refresh:

- scoped permissions
- content
- events
- community
- leadership tools
- tenant headers/context

Do not switch only the visible label while leaving authorization/data in the old tenant.

## Feature gates

Feature visibility should respect backend/platform/tenant feature flags and permissions.

Do not show Giving, AI, streaming, etc. if disabled by configuration.

## Deep links

Notifications/content actions should open the correct resource and restore the correct tenant/context safely.

Handle unavailable/deleted/private resources with explicit user-facing states rather than crashes.

## Current mobile state

The mobile app is already substantially implemented and has begun the latest Navy/White redesign. Continue from the current route/component tree; do not throw away functional APIs/media flows just because presentation is still incomplete.

The immediate application work is integration, UX consistency, correctness of real data/state, removal of obsolete styling/static fallbacks, responsiveness and production verification.