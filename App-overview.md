# Mobile App: Screen, API, Function, and Data Overview

> Updated 7 September 2026. This is the connection map for `apps/mobile`. All API names below are Supabase Edge Functions under `supabase/functions/<name>/index.ts`; `ApiClient.request` supplies the access token plus the selected `X-Organization-Id` and `X-Branch-Id`. Public reads explicitly use public context. A screen with “redirect” deliberately has no data call: it forwards to the canonical screen so there is only one implementation.

## Runtime data flow

1. `_layout.tsx` installs session, branding and theme providers. `state/session.tsx` restores the secure session, gets `organization-context`, and constructs the scoped `ApiClient`.
2. A screen invokes `api.request(function-name, options)`, generally through `useResource`, which handles loading, error, abort, refresh, and cached data.
3. `src/api.ts` sends the request to `EXPO_PUBLIC_API_URL/<function-name>`, applies a 15-second timeout, and translates backend errors into safe user-facing messages.
4. The Edge Function authenticates and authorizes the exact organization/Expression capability, then reads or mutates PostgreSQL through Supabase. Storage uploads use a server-issued one-use signed URL, a direct byte upload, then a verification/finalization call.
5. The screen refreshes its resource. Public mutations display wherever the same table is read (for example a published sermon appears in Discover, Home and its detail route; a featured leader appears in Church Story).

## Screen-by-screen connection map

| Screen(s) | Purpose and principal functions | API / destination |
|---|---|---|
| `/`, `/index` | Startup gate selects onboarding, authentication, or tabs. | Session state; navigation only. |
| `/(auth)/login` | Credential login and session creation. | Session `signIn()` → `login`; persisted by `saveAuth`. |
| `/(auth)/signup` | Create account and verify code. | `signup`, `verify-otp`. |
| `/(auth)/forgot-password`, `/reset-password` | Recovery request and password replacement. | `password-recovery`, `password-reset`. |
| `/onboarding` | Saves identity, preferences, church and Expression selection. | `onboarding`; updates `profiles`, preferences and memberships, then reloads session context. |
| `/(tabs)/home` | Ranked home modules; reactions and resume state. | Child cards receive Home data from session/feed; `engagement` mutates reactions/progress. |
| `/(tabs)/community` | General or Expression posts, composer, attachments, reactions. | `public-social-feed`/`social-feed`; `community-media` signed upload; `engagement`. Posts persist to `social_posts` and upload metadata to `social_media_uploads`. |
| `/post/[id]`, `/comments/[contentId]` | Canonical post and comment/reaction thread. | `social-feed` or `public-social-feed`; `engagement` for comments/reactions. |
| `/(tabs)/community/groups` | Expression groups. | `groups` → `groups`, `group_memberships`. |
| `/(tabs)/community/birthdays` | Scoped birthday list. | `expression-birthdays` → profile/member birthday data. |
| `/(tabs)/community/leadership` | Expression/public leader directory. | `church-story?view=leadership` → `leadership_profiles`. |
| `/(tabs)/discover` | Published sermon/series discovery. | `public-content` → `sermons`, `sermon_series`. |
| `/(tabs)/discover/church-story` | Published church story and featured leaders. | `church-story` → `church_story`, `leadership_profiles`. |
| `/(tabs)/discover/sermon/[id]` | Compatibility route. | Redirects to `/sermon/[id]`. |
| `/sermon/[id]` | Banner, text notes/scripture, optional video/audio playback and progress. | `public-content` or scoped `sermons`; `sermon-playback` resolves safe media URLs; `engagement` syncs progress. |
| `/series/[id]` | Series metadata and sermons. | `public-content` → `sermon_series`, `sermons`. |
| `/(tabs)/watch`, `/watch/[id]` | Long-form video feed/detail and engagement. | `home-feed`, `public-content`, `content-media` playback, `engagement`. |
| `/(tabs)/reels`, `/reels` | Reel feed/player, reactions and reference shares. | `home-feed`, `public-content`, `content-media`, `engagement`, `social-feed`. |
| `/(tabs)/live`, `/(tabs)/live/[id]` | Live directory and player/interactions. | `home-feed`; `stream-access`, `live-interactions`, `stream-presence` → `live_streams` and live interaction tables. |
| `/event/[id]` | Public/scoped event and registration lifecycle. | `events`/`public-content`; `event-registrations` → `events`, `event_registrations`. |
| `/expression/[id]`, `/expressions` | Public Expression profile, follow/join. | `public-content`, `follows`, `expression-memberships` → `branches`, follows/memberships. |
| `/giving`, `/(tabs)/profile/giving` | Giving destination and checkout UI. | Shared `GivingScreen` → `public-giving`, `giving`, `payment-checkout`; donation/payment tables. |
| `/prayer`, `/(tabs)/profile/prayer` | Submit and review own prayers. | `prayer-requests` → `prayer_requests`; route wrappers share canonical implementation. |
| `/(tabs)/profile` | Profile hub, capabilities and assistant entry. | Session context; `ai-gateway` where assistant prompt is used. |
| `/assistant` | Church-aware AI assistant. | `ai-gateway`; provider selection/usage recorded server-side. |
| `/(tabs)/profile/notifications` | Inbox and governance invitation responses. | `notifications`, `governance-invitations`. |
| `/(tabs)/profile/notification-settings` | Delivery preferences. | `notification-settings` → `notification_preferences`. |
| `/(tabs)/profile/saved` | Saved content list. | `engagement?view=saved`. |
| `/(tabs)/profile/settings` | Profile edit and avatar. | `profile`; multipart `profile-avatar` → `profiles`, `profile-avatars` bucket. |
| `/studio`, `/studio/reel`, `/studio/video` | Creator library and reel/video uploads. | `creator-studio`; `content-media` intent/direct upload/complete → `media_assets`, `media_renditions`, `reels`, `videos`. |
| `/(tabs)/profile/leadership` | Capability-gated ministry console. | Session capability map; `expression-ownership`. |
| `.../leadership/sermons-manage` | Creates/edits **sermons as text with optional audio**, requires a banner, uploads audio, publishes. | `sermons`; banner signed upload to `sermon-banners`; `content-media` audio to `content-media`; writes `sermons.thumbnail_url` and `audio_asset_id`. Result appears in Discover/Home/sermon detail according to status and visibility. |
| `.../leadership/church-leadership` | Church leader CRUD and portrait upload. | `church-story`; signed upload to `leadership-portraits`; writes `leadership_profiles.portrait_url`. Featured active leaders appear in public Church Story. |
| `.../leadership/expression-leadership` | Expression leader CRUD. | `church-story` → Expression-scoped `leadership_profiles`. |
| `.../leadership/events-manage` | Event CRUD/publishing. | `events` → public event views and registration screen. |
| `.../leadership/expressions-manage` | Expression administration. | `branches` → `branches`; updates pickers/directories. |
| `.../leadership/expression-governance` | Ownership and role invitations. | `expression-role-invitations`, `expression-ownership`. |
| `.../leadership/giving-manage`, `giving-finance` | Giving designation setup and scoped finance reporting. | `giving`, `finance` → funds/designations/donations/ledger views. |
| `.../leadership/media-studio` | Start/manage live broadcasts. | `streaming-broadcasts`, `live-streams`. |
| `.../leadership/pastoral-triage` | Wrapper for pastoral work queue. | Canonical `/leadership/pastoral-triage`: `prayer-requests`, `pastoral-followups`. |
| `/leadership/*` legacy routes | Backward-compatible URLs for directory, events, expressions, giving, media, sermons and invitations. | Redirect to the corresponding `/(tabs)/profile/leadership/*` screen; no duplicate database logic. |
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

## Change propagation checklist

- Sermon draft: leadership list only. Published public sermon: Discover/Home/series/detail. Published Expression sermon: that Expression’s scoped surfaces.
- Sermon banner/audio replacement: `sermons` management refresh immediately; public caches refresh on navigation/reload and playback resolves the new asset.
- Church leader: management directory immediately. Only `is_active && is_featured_public` rows appear publicly; Expression rows remain Expression-scoped.
- Events, posts, videos/reels, prayers, giving and notifications appear in their respective consumer screens only after their endpoint’s publish/visibility/status rules permit them.
