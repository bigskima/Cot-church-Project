# General COT and Expression Navigation Migration

## Product decision

COT has two deliberately different member-facing environments:

1. **General COT** — the church-wide, public/corporate experience.
2. **Expressions** — private, membership-bound community workspaces that users explicitly enter.

They may reuse lower-level product components, API clients, domain services, media players, cards, design tokens, auth, permissions and backend contracts. They must not share a single navigation shell that silently changes behavior based on `context.expression`.

Internal routes use immutable Expression IDs.

## Canonical route model

```text
/general
  -> canonical General COT entry

/expressions
  -> membership switcher / join flow

/expressions/[expressionId]
  -> canonical private Expression workspace

/expression/[id]
  -> public Expression profile / discovery surface
```

Public Expression profiles and private Expression workspaces are intentionally different routes.

## Boundary rules

### General COT

- General COT is never an Expression-aware variant of the same tab screen.
- If a private Expression context is active, the General tab shell must not render.
- Returning to General COT clears the active Expression context first.
- Visitors may remain entirely in General COT.
- Authentication adds interaction rights; it does not inject private Expression navigation into General COT.

### Expressions

- The Expression ID in the route is the source of truth for the workspace being opened.
- The authenticated account must have an active membership matching that exact ID.
- The runtime synchronizes the selected backend Expression context to the route before rendering private content.
- A stale selected Expression must never cause a different Expression route to render its data.
- Expression navigation is owned by the Expression workspace, not by General COT tabs.
- The workspace must always expose a clear route back to General COT.

## Shared code policy

Reuse:

- `PostCard`
- `SermonCard`
- `EventCard`
- Reel/video/live players
- comments and engagement primitives
- uploads
- design tokens
- auth/session
- API client
- query cache
- streaming adapters
- giving engine
- notifications
- AI services
- backend functions and database contracts

Do not reuse as one hybrid route screen:

- General Home and Expression Home
- General Community and Expression Feed
- General Live and Expression Live
- General media catalogue and Expression media catalogue
- General leadership entry and Expression management navigation

The goal is **shared components and domain services, separate route-level information architecture**.

## Responsive Expression navigation

### Mobile

Expression workspace uses a dedicated top bar and drawer-style navigator.

Initial foundation:

```text
Expression
  Overview
    Home

  Space
    My Expressions

  COT
    Return to General COT
```

As destinations are migrated, the navigator becomes:

```text
OVERVIEW
  Home
  Announcements
  Live

COMMUNITY
  Feed
  Prayer
  Events
  Birthdays

MINISTRIES & GROUPS
  Groups
  Departments / teams where supported

MEDIA
  Sermons
  Videos
  Reels

PEOPLE
  Members
  Leadership

MY EXPRESSION
  Giving
  Saved
  Notifications

LEADERSHIP (permission gated)
  Studio
  Live Studio
  Events
  Media
  Roles & Access
  Giving Administration
  Expression Settings
```

### Tablet / web

The same information architecture becomes a persistent left sidebar. Content remains in the right workspace pane.

## Migration phases

### Phase 1 — route and shell foundation

- canonical `/general` entry
- canonical `/expressions/[expressionId]` workspace
- exact-ID membership route boundary
- dedicated responsive Expression shell
- dedicated Expression Home
- General tabs blocked while a private Expression is active
- Expression entry no longer routes to `/(tabs)/home`
- application invariants protect the new boundary

### Phase 2 — Expression community navigation

Move into dedicated Expression routes:

- Feed
- Announcements
- Prayer
- Events
- Birthdays

No General route should be used as the Expression destination after each area is migrated.

### Phase 3 — Expression media and live

Implemented:

- `/expressions/[expressionId]/live`
- `/expressions/[expressionId]/live/[streamId]`
- `/expressions/[expressionId]/sermons`
- `/expressions/[expressionId]/sermons/[sermonId]`
- `/expressions/[expressionId]/videos`
- `/expressions/[expressionId]/videos/[videoId]`
- `/expressions/[expressionId]/reels`

The Expression shell now owns Live, Sermons, Videos and Reels navigation. Shared players, cards, playback, engagement, Mux runtime and media services remain canonical; only route-level information architecture is separated.

General Watch, General Reels and General Live are explicitly General-only. Legacy Expression media links redirect into the canonical exact-ID Expression workspace where practical. Expression media detail views verify that the resolved video, sermon or broadcast belongs to the exact active Expression before rendering it.

### Phase 4 — Groups and people

Implemented:

- `/expressions/[expressionId]/groups`
- `/expressions/[expressionId]/groups/[groupId]`
- `/expressions/[expressionId]/members`
- `/expressions/[expressionId]/leadership`

The Expression shell now owns Groups, Members and Leadership navigation. The existing Groups UI/API is reused through a scoped feature experience, including join requests, group creation and membership review where capabilities allow it. Group detail routes stay inside the same exact Expression boundary.

The member directory extends the canonical `memberships` Edge Function with a member-facing `expression-directory` view rather than creating another membership system. The route Expression ID must match the authenticated active Expression, the caller must have an active `expression_memberships` row, and the response exposes only safe directory fields: display name, username, avatar and join date. Phone numbers and administration-only membership data remain outside this view.

The existing Expression leadership directory remains backed by `church-story?view=leadership` and `leadership_profiles`, but now has a canonical Expression-owned route. Leadership management remains in the existing leadership area until Phase 5 moves Expression operations into the workspace.

### Phase 5 — Expression leadership

Implemented canonical Expression management routes:

- `/expressions/[expressionId]/manage`
- `/expressions/[expressionId]/manage/studio`
- `/expressions/[expressionId]/manage/reel`
- `/expressions/[expressionId]/manage/video`
- `/expressions/[expressionId]/manage/sermons`
- `/expressions/[expressionId]/manage/live`
- `/expressions/[expressionId]/manage/events`
- `/expressions/[expressionId]/manage/leadership`
- `/expressions/[expressionId]/manage/invite-codes`
- `/expressions/[expressionId]/manage/access`
- `/expressions/[expressionId]/manage/settings`
- `/expressions/[expressionId]/manage/giving`
- `/expressions/[expressionId]/manage/finance`

All management navigation is generated from one shared `useExpressionManagementAccess` capability resolver. The resolver consumes the already-resolved Expression permissions plus accountable ownership state, so sidebar visibility, the management hub and route gates use the same authority model.

Existing leadership, studio, live, sermon, event, giving, role/invitation and ownership implementations remain canonical underneath; Phase 5 changes their route ownership and presentation rather than creating duplicate operational systems. The old Profile Leadership and Studio hubs canonicalize an active Expression back into its workspace, while legacy deep links remain compatibility paths until Phase 7 cleanup.

Expression Content Studio, Reel, Watch, Live Studio and Giving configuration are locked to the active Expression when rendered below `/expressions/[expressionId]/manage`. A user who separately has public/church-wide authority cannot use an Expression management route to switch destination scope.

Expression Settings uses the existing `branches.update` backend permission and exposes only day-to-day identity fields (name, member-facing code and timezone). Immutable route identity remains the Expression UUID, and platform lifecycle controls such as suspension/archive are intentionally excluded.

### Phase 6 — General COT route migration

Move existing church-wide routes under the General shell and remove remaining General screens that inspect `context.expression` to change personality.

### Phase 7 — cleanup and hardening

- remove compatibility routes
- update deep links
- verify browser refresh behavior
- verify multiple-Expression switching
- verify join/leave lifecycle
- verify expired/suspended membership handling
- verify role changes while inside an Expression
- verify private content never appears in General COT
- verify mobile, tablet and web navigation history
- verify old saved links fail closed or redirect safely

## Non-negotiable security invariant

A private Expression route must be authorized by the exact route Expression ID and active membership before rendering or requesting scoped private data.

A selected session context alone is not sufficient authorization.
