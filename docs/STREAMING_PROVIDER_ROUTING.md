# COT Streaming Provider Routing

Status: **database migration applied to COT Supabase; application/backend code remains on the implementation branch until build validation and provider credentials are complete.**

Branch: `feature/youtube-general-agora-expressions`

Supabase project: `Cot digital app` (`yqvkkgpffskszmmdwqxx`)

## Product routing

| COT surface | Launch provider | Broadcast origin | Access |
|---|---|---|---|
| General COT | YouTube Live | Existing/public YouTube channel | Public |
| Expression Live | Agora RTC | In-app COT broadcaster | Authenticated + exact Expression access |
| Future premium/fallback | Mux | RTMP/RTMPS encoder | Existing provider contract |

Provider routing is stored in `streaming_provider_configs.configuration.routingScopes`.
Supported values are `general` and `expression`. Once explicit routing exists,
the runtime must not silently select a provider assigned to another surface.

## Supabase Free-plan consolidation

COT is already at the Edge Function limit on the current Supabase plan. The first
attempt to create a new `general-live-source` function was rejected by Supabase
because the project had reached its maximum function count.

The launch architecture therefore uses existing function slots only:

- `home-feed` owns General YouTube live discovery and injects the current/upcoming
  external livestream into the existing `streams` response.
- `stream-access` validates a selected YouTube video or an internal live stream.
  For Agora live streams it also returns the short-lived subscriber RTC grant.
- `streaming-broadcasts` creates Expression RTC broadcasts and returns the
  broadcaster's short-lived Agora publisher grant in the create response.
- `platform-streaming` remains the Platform Admin control plane.

No new Edge Function slug is required.

## General COT / YouTube

Platform Administration stores:

- provider code: `youtube`
- protected secret reference: `STREAMING_YOUTUBE_DATA_API`
- public configuration:
  - `routingScopes: ["general"]`
  - `channelId`
  - `includeUpcoming`
- the API key remains in Platform Vault.

COT does not require the YouTube password or an OAuth grant to display public
broadcasts. The configured API key retrieves public channel/video metadata.
Changing from a temporary personal channel to the official COT channel is a
Platform Admin configuration change only.

### Shared YouTube discovery cache

Migration `20260918103036_cot_streaming_provider_routing.sql` created
`general_live_source_cache`. It is server-only:

- RLS is enabled;
- `anon` and `authenticated` have no table privileges;
- only `service_role` can read/write it;
- the refresh-claim and write RPCs are also service-role-only.

Migration `20260918103125_fix_general_live_cache_claim.sql` makes a provider
configuration or Channel ID change invalidate the old cache immediately.

Discovery behavior is quota-aware:

1. a known video uses `videos.list` to track scheduled/live state;
2. `search.list` is used only to discover a new live/upcoming video;
3. a database refresh claim prevents multiple Edge isolates from searching at once;
4. idle discovery uses a longer TTL than active-live checks.

## Expression / Agora

Platform Administration stores:

- provider code: `agora`
- protected secret reference: `STREAMING_AGORA_PRIMARY`
- protected JSON:
  - `appId`
  - `appCertificate`
- public configuration:
  - `routingScopes: ["expression"]`
  - `tokenTtlSeconds`
  - `cohostAuthenticationEnabled`
  - free-tier informational/safety values.

The App Certificate is server-only and must never be exposed to Expo public
variables or returned to clients.

An authorized Expression broadcaster:

1. creates the broadcast through `streaming-broadcasts`;
2. COT creates an ephemeral Agora channel identity;
3. the same response contains a short-lived publisher grant;
4. the in-app Live Media Studio joins Agora as host;
5. COT marks the stream `live` when the host joins successfully.

A viewer:

1. opens an Expression live stream;
2. `stream-access` validates `can_access_stream`;
3. if the stream is live, `stream-access` returns a short-lived subscriber grant;
4. the app joins Agora in audience mode.

### Mandatory Agora security setting

Agora Co-host token authentication must be enabled in Agora Console before
Expression Live becomes ready. COT treats
`cohostAuthenticationEnabled=true` as a launch gate and refuses to issue live
RTC grants until Platform Admin confirms it.

## Mux

The Mux adapter and existing credential references are preserved.

Migration `20260918103036_cot_streaming_provider_routing.sql` disabled the Mux
provider/config for launch and added `launchStatus: disabled_until_funded`.
Nothing was deleted. It can be deliberately re-enabled/routed later without
rebuilding the streaming abstraction.

## Applied database work

Applied on 2026-09-18:

- `20260918103036_cot_streaming_provider_routing`
- `20260918103125_fix_general_live_cache_claim`

The migration installs YouTube and Agora provider records, keeps their configs
inactive until credentials are entered, disables Mux for launch, and creates the
server-only General YouTube cache.

## Deployment plan

Update existing functions only:

- `home-feed` — `verify_jwt=false`, public/optional-auth aggregation.
- `stream-access` — preserve the existing authenticated gateway policy.
- `streaming-broadcasts` — preserve the existing authenticated gateway policy.
- `platform-streaming` — preserve the existing authenticated gateway policy.

After deployment:

1. Configure YouTube Channel ID + Data API key in Platform Admin.
2. Configure Agora App ID + App Certificate.
3. Enable Agora Co-host token authentication in Agora Console and confirm it in Admin.
4. Test one public YouTube General stream.
5. Test one private Expression stream as broadcaster, authorized member and unauthorized account.
6. Re-run Supabase security/performance advisors.

## Mobile build boundary

Agora introduces a native React Native dependency. A fresh Android/iOS binary is
required; this cannot be delivered only as an Expo OTA update.

Before merging the feature branch, regenerate the root `package-lock.json` for
the new mobile dependencies and run the repository mobile/admin typechecks plus
web/native build checks.


<!-- Netlify preview trigger: PR #54, 2026-09-18 -->

<!-- Netlify env rebuild trigger: PR #54, 2026-09-18 -->
