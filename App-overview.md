# Mobile App: Screen, API, Function, and Data Overview

> Updated 7 September 2026. This is the connection map for `apps/mobile`. All API names below are Supabase Edge Functions under `supabase/functions/<name>/index.ts`; `ApiClient.request` supplies the access token plus the selected `X-Organization-Id` and `X-Branch-Id`. Public reads explicitly use public context. A screen with “redirect” deliberately has no data call: it forwards to the canonical screen so there is only one implementation.

## Runtime data flow

1. `_layout.tsx` installs session, branding and theme providers. `state/session.tsx` restores the secure session, gets `organization-context`, and constructs the scoped `ApiClient`.
2. A screen invokes `api.request(function-name, options)`, generally through `useResource`, which handles loading, error, abort, refresh, and cached data.
3. `src/api.ts` sends the request to `EXPO_PUBLIC_API_URL/<function-name>`, applies a 15-second timeout, and translates backend errors into safe user-facing messages.
4. The Edge Function authenticates and authorizes the exact organization/Expression capability, then reads or mutates PostgreSQL through Supabase. Storage uploads use a server-issued one-use signed URL, a direct byte upload, then a verification/finalization call.
5. The screen refreshes its resource. Public mutations display wherever the same table is read (for example a published sermon appears in Discover, Home and its detail route; a featured leader appears in Church Story).

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
`MediaPreviewModal` is the shared, context-free full-file viewer. Public, church and Expression screens can pass it an image, video, audio recording, or document URL without changing organization context. Community attachments, sermon banners, and leader portraits open independently from their parent content; the modal also offers **Open original** for viewing, downloading, or handing a file to another compatible app.

>>>>>>> theirs
=======
`MediaPreviewModal` is the shared, context-free full-file viewer. Public, church and Expression screens can pass it an image, video, audio recording, or document URL without changing organization context. Community attachments, sermon banners, and leader portraits open independently from their parent content; the modal also offers **Open original** for viewing, downloading, or handing a file to another compatible app.

>>>>>>> theirs
=======
`MediaPreviewModal` is the shared, context-free full-file viewer. Public, church and Expression screens can pass it an image, video, audio recording, or document URL without changing organization context. Community attachments, sermon banners, and leader portraits open independently from their parent content; the modal also offers **Open original** for viewing, downloading, or handing a file to another compatible app.

>>>>>>> theirs
## Screen-by-screen connection map

| Screen(s) | Purpose and principal functions | API / destination |
|---|---|---|
| `/`, `/index` | Startup gate selects onboarding, authentication, or tabs. | Session state; navigation only. |
| `/(auth)/login` | Credential login and session creation. | Session `signIn()` → `login`; persisted by `saveAuth`. |
| `/(auth)/signup` | Create account and verify code. | `signup`, `verify-otp`. |
| `/(auth)/forgot-password`, `/reset-password` | Recovery request and password replacement. | `password-recovery`, `password-reset`. |
| `/onboarding` | Saves identity, preferences, church and Expression selection. | `onboarding`; updates `profiles`, preferences and memberships, then reloads session context. |
| `/general` | Canonical church-wide Home. Never requests private Expression ranking; an explicit General entry clears active Expression context before rendering. | `home-feed` without `expressionId`; `engagement` for public interactions. |
| `/general/explore` | Canonical public discovery for sermons, series, events, Watch, Reels, leaders and public Expression profiles. | `public-content`, `church-story`. |
| `/general/community`, `/general/post/[id]`, `/general/comments/[contentId]` | General Community feed, post detail and comments. | `public-social-feed?scope=church`; `community-media`; `engagement` in public context. |
| `/general/reels` | Canonical General Reels player and engagement. | `public-content`, `content-media`, `engagement`. |
| `/general/watch`, `/general/watch/[id]` | Canonical General long-form video catalogue and detail. | `public-content`, `content-media`, `engagement`. |
| `/general/live`, `/general/live/[id]` | Canonical General livestream directory/player. | `home-feed` without Expression scope; `stream-access`, `live-interactions`, `stream-presence`. |
| `/general/sermon/[id]`, `/general/series/[id]` | Public sermon and series detail inside the General shell. | `public-content`, `sermon-playback`, `engagement`. |
| `/general/event/[id]` | Public event detail and registration inside General. | `public-content`; `event-registrations`. |
| `/general/expression/[id]`, `/expressions` | Public Expression profile followed by deliberate entry to a private Expression workspace. | `public-content`, `follows`, `expression-memberships`. |
| `/general/giving` | Church-wide giving destination and receipts; Expression scope is unavailable from this route. | Shared `GivingScreen` locked to church scope → `public-giving`, `giving`, `payment-checkout`. |
| `/general/prayer` | General prayer wall and church/pastoral request submission. | `prayer-requests` in General scope. |
| `/general/profile`, `settings`, `notifications`, `notification-settings`, `saved` | General account hub and personal services. Expression operations are not surfaced here. | Session context, `profile`, `profile-avatar`, `notifications`, `engagement?view=saved`. |
| `/general/assistant` | General church-aware AI assistant. | `ai-gateway`. |
| `/general/studio`, `/general/studio/reel`, `/general/studio/video` | Church-wide creator studio. Expression publishing is unavailable from these General routes. | `creator-studio`, `content-media`; organization/public capabilities. |
| `/general/leadership/*` | Church-wide ministry operations: live, pastoral care, church leadership, giving, finance, sermons, events and Expression creation authority. | Existing production leadership screens/APIs, forced through organization/public scope by the General workspace. |
| Legacy `/(tabs)/*`, root media/detail routes and simple `/leadership/*` aliases | Redirect-only compatibility paths for old browser history, bookmarks and previous app links. Private legacy links without an exact Expression ID fail closed. | Forward to canonical `/general/*`, `/expressions/[expressionId]/*`, or `/expressions`; they no longer own a navigation shell. |
| `/expressions/[expressionId]/manage` | Canonical permission-filtered Expression operations hub. | Shared Expression capability resolver + `expression-ownership`; links only to operations granted in the active Expression. |
| `/expressions/[expressionId]/manage/studio`, `reel`, `video` | Expression-only content creation. Public publishing is disabled inside these workspace routes. | Existing community/creator studio and `content-media` / `creator-studio` contracts are reused with active Expression scope. |
| `/expressions/[expressionId]/manage/sermons`, `live`, `events` | Expression sermon, livestream and event operations. | Existing `sermons`, `streaming-broadcasts` / `live-streams`, and `events` APIs remain server-authoritative and branch-scoped. |
| `/expressions/[expressionId]/manage/leadership`, `invite-codes`, `access` | Expression leadership directory management, member access, scoped role invitations and ownership. | Existing `church-story`, invite-code APIs, `expression-role-invitations`, and `expression-ownership`. |
| `/expressions/[expressionId]/manage/settings` | Day-to-day Expression identity settings (name, member-facing code, timezone). | `branches?id=...` PATCH guarded by `branches.update`; route identity remains the immutable Expression UUID. |
| `/expressions/[expressionId]/manage/giving`, `finance` | Expression-only giving setup and scoped finance reporting. | Existing `giving` and `finance` APIs use the active branch context; church-wide scope is unavailable from the Expression workspace. |
| `/general/leadership` | Canonical church-wide ministry console. | Organization/public capability map; Expression operations live under `/expressions/[expressionId]/manage`. |
| `.../leadership/sermons-manage` | Creates/edits **sermons as text with optional audio**, requires a banner, uploads audio, publishes. | `sermons`; banner signed upload to `sermon-banners`; `content-media` audio to `content-media`; writes `sermons.thumbnail_url` and `audio_asset_id`. Result appears in Discover/Home/sermon detail according to status and visibility. |
| `.../leadership/church-leadership` | Church leader CRUD and portrait upload. | `church-story`; signed upload to `leadership-portraits`; writes `leadership_profiles.portrait_url`. Featured active leaders appear in public Church Story. |
| `.../leadership/expression-leadership` | Expression leader CRUD. | `church-story` → Expression-scoped `leadership_profiles`. |
| `.../leadership/events-manage` | Event CRUD/publishing. | `events` → public event views and registration screen. |
| `.../leadership/expressions-manage` | Expression administration. | `branches` → `branches`; updates pickers/directories. |
| `.../leadership/expression-governance` | Ownership and role invitations. | `expression-role-invitations`, `expression-ownership`. |
| `.../leadership/giving-manage`, `giving-finance` | Giving designation setup and scoped finance reporting. | `giving`, `finance` → funds/designations/donations/ledger views. |
| `.../leadership/media-studio` | Start/manage live broadcasts. | `streaming-broadcasts`, `live-streams`. |
| `.../leadership/pastoral-triage` | Wrapper for pastoral work queue. | Canonical `/leadership/pastoral-triage`: `prayer-requests`, `pastoral-followups`. |
| `/leadership/*` legacy routes | Compatibility entry points only. Simple aliases redirect to `/general/leadership/*`; Expression-only aliases fail closed or render only when imported below an exact Expression boundary. | No private data is authorized from a legacy route identity alone. |
| `+not-found` | Invalid-route recovery. | Navigation only. |

## Core database and storage map

- **Identity and tenancy:** `profiles`, `organizations`, `branches`, `memberships`, roles, permissions and assignments. Every protected function resolves organization/Expression context before querying.
- **Published content:** `content_items` is the cross-content identity; `sermons`, `sermon_series`, `videos`, `reels`, `media_assets`, and `media_renditions` hold typed content and playback references.
- **Sermons:** `sermons.description`/`transcript` are readable content. `audio_asset_id` and `video_asset_id` are optional media, while `thumbnail_url` is the required presentation banner in the mobile composer. This prevents “sermon” from meaning “audio”.
- **Community and engagement:** social posts/uploads plus canonical engagement tables provide reactions, comments, saves, follows, shares and playback progress.
- **Operations:** events/registrations, groups, prayer/pastoral follow-ups, giving/finance, live streams/interactions, notification delivery and audit tables are separated by concern and protected by RLS plus Function authorization.
- **Storage:** `content-media` is private and playback URLs are resolved by APIs. `sermon-banners` and `leadership-portraits` are public-read presentation buckets; writes require a short-lived signed URL issued only after capability checks. `profile-avatars` uses its dedicated authenticated multipart endpoint.

## Upload contract and troubleshooting

All new mobile uploads use `src/services/uploads.ts`: picker asset → Blob → API upload intent → signed `PUT` (without an app authorization header) → server completion/verification → parent record mutation. Never store a device `file://` URI in PostgreSQL. If an upload fails, check the Function response first, then bucket migration, MIME allow-list, file size, selected organization/Expression and the caller’s `media.upload` or leadership/sermon capability. The UI preserves the selected file and shows a retryable error rather than silently publishing a disconnected record.

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
The `NOTICE ... policy ... does not exist, skipping` messages printed on the migration's first deployment are expected: each policy is dropped with `IF EXISTS` before it is created, which makes the migration safe across fresh and previously configured environments. `Finished supabase db push` confirms that both buckets and their read policies were applied.

>>>>>>> theirs
=======
The `NOTICE ... policy ... does not exist, skipping` messages printed on the migration's first deployment are expected: each policy is dropped with `IF EXISTS` before it is created, which makes the migration safe across fresh and previously configured environments. `Finished supabase db push` confirms that both buckets and their read policies were applied.

>>>>>>> theirs
=======
The `NOTICE ... policy ... does not exist, skipping` messages printed on the migration's first deployment are expected: each policy is dropped with `IF EXISTS` before it is created, which makes the migration safe across fresh and previously configured environments. `Finished supabase db push` confirms that both buckets and their read policies were applied.

>>>>>>> theirs
## Change propagation checklist

- Sermon draft: leadership list only. Published public sermon: Discover/Home/series/detail. Published Expression sermon: that Expression’s scoped surfaces.
- Sermon banner/audio replacement: `sermons` management refresh immediately; public caches refresh on navigation/reload and playback resolves the new asset.
- Church leader: management directory immediately. Only `is_active && is_featured_public` rows appear publicly; Expression rows remain Expression-scoped.
- Events, posts, videos/reels, prayers, giving and notifications appear in their respective consumer screens only after their endpoint’s publish/visibility/status rules permit them.
