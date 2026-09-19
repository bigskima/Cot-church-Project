# Platform Administration and Ministry Tools Boundary

This is the implementation contract for separating the dedicated Platform Administration web app from ministry operations in the COT app.

## Ownership matrix

| Capability | Owning surface | Required authority | Platform Administration boundary |
| --- | --- | --- | --- |
| Platform Administrator invitations | Platform Administration web app | `platform.roles.manage` plus the existing Super Admin UI gate | Create, revoke, and audit here only. The recipient accepts or declines here after signing in. |
| Platform Administrator invitation notice | COT app notification delivery | System-generated event | The app may display or push the notice and link to the web app. It cannot create, accept, or decline the invitation. |
| Platform roles and global public capabilities | Platform Administration web app | `platform.roles.read` / `platform.roles.manage` | These are software-level or global public capabilities, not church ministry roles or presentation titles. |
| Account bans and public-content moderation | Platform Administration web app | Platform user/moderation permissions | Platform safety remains global and audited. Private pastoral records are not exposed. |
| Organisations and Expression lifecycle governance | Platform Administration web app | Platform organisation/Expression permissions | Platform Admin may govern lifecycle and availability, but does not run local ministry work. |
| Service providers, credentials, feature availability, audit, queue telemetry | Platform Administration web app | Corresponding platform permissions | Notification queue inspection/retry is infrastructure work; composing a church notification is not. |
| Emergency stream termination | Platform Administration web app | `platform.streaming.manage` | A safety/operations control. Scheduling or presenting ministry broadcasts remains in scoped COT tools. |
| General COT ministry roles | COT app, General `Roles & Access` | Church-scoped `roles.*` and `members.*` permissions | Platform Administration cannot grant these roles. |
| Expression roles and ownership | COT app, inside that Expression | Expression-scoped membership and role permissions | Remains inside the exact Expression context. |
| Church story and central leadership directory | COT app, General ministry tools | `organization.leadership.manage` | No Platform Administration authoring route. |
| Church-wide presentation titles and badges | COT app, General `Titles & badges` | `organization.leadership.manage` | Presentation only; never grants permissions. |
| Expression presentation titles and badges | COT app, Expression ministry tools | `expression.leadership.manage` | Limited to active members and definitions in that Expression. |
| Church and Expression announcements/notifications | COT app, scoped ministry tools | Scoped announcement/notification permissions | Platform Admin cannot compose or broadcast church-facing notifications. |
| Giving campaigns and ministry finance | COT app, scoped ministry tools | Scoped giving/finance permissions | Platform Administration may configure payment infrastructure, but does not operate church giving. |

## Platform Administrator invitation flow

1. A Super Admin creates the invitation in the Platform Administration web app.
2. The database records the pending platform-role invitation and audit event.
3. If the recipient has an active church membership, COT creates a system notification and push-outbox item. This is delivery, not a Platform Admin-authored church broadcast.
4. The COT app shows the invitation as a web handoff. It exposes no Accept or Decline mutation for a platform role.
5. The recipient opens the Platform Administration web app and signs in with the invited account.
6. Before persisting the admin session, the web app loads pending platform invitations.
7. Accept or Decline goes through the web-only response path in `platform-admin-invitations` and its service-only database RPC.
8. On acceptance, the role is granted, audited, and the normal Platform Administration authority check succeeds.

The general `governance-invitations` endpoint and `respond_governance_invitation` RPC reject platform-role responses. They remain the COT-app path for Expression ministry invitations only.

## Retired Platform Administration ministry paths

The following permissions are inactive and removed from platform-role grants:

- `platform.notifications.broadcast`
- `platform.identity_badges.manage`
- `platform.public_directory.manage`

The legacy `platform-public-directory` endpoint returns a retired-boundary response. The Platform Integrations endpoint keeps delivery telemetry and safe retry controls, but contains no notification-composition action. Existing database records are preserved for audit and compatibility; the migration does not destructively drop them.

## Compatibility rule

Legacy mobile Platform Administration URLs remain hidden routes so old links do not crash. They render only a handoff to the separate web app and never load platform context or platform operation APIs.

## Regression requirements

- Mobile source must not call Platform Administration operation endpoints.
- General Roles & Access must not reference `platform-admin-invitations`.
- Platform-role invitations must have no mobile Accept or Decline action.
- Platform Administration navigation must not expose church directory, title/badge, or notification-authoring pages.
- General title/badge mutations must require `organization.leadership.manage`; Expression mutations must require `expression.leadership.manage` in the exact active Expression.
- The service-only platform invitation response RPC must never be granted to `anon` or `authenticated`.
