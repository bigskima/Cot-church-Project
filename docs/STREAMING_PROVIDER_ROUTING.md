# COT Streaming Provider Routing

Status: **implementation branch only — do not deploy until the COT Supabase project is connected and reviewed**

Branch: `feature/youtube-general-agora-expressions`

## Product routing

| COT surface | Launch provider | Broadcast origin | Access |
|---|---|---|---|
| General COT | YouTube Live | Existing/public YouTube channel | Public |
| Expression Live | Agora RTC | In-app COT broadcaster | Authenticated + Expression access |
| Future premium/fallback | Mux | RTMP/RTMPS encoder | Existing provider contract |

Provider routing is stored in `streaming_provider_configs.configuration.routingScopes`.
Supported values are `general` and `expression`. Once explicit routing exists,
the runtime must not silently select a provider routed to another surface.

## General COT / YouTube

Platform Administration stores:

- provider code: `youtube`
- protected secret reference: `STREAMING_YOUTUBE_DATA_API`
- public configuration:
  - `routingScopes: ["general"]`
  - `channelId`
  - `includeUpcoming`
- the API key remains in Platform Vault.

COT does not require the YouTube password or OAuth grant to display public
broadcasts. The configured API key retrieves public channel/video metadata.
The channel can be switched later by changing Platform Administration
configuration only.

The `general-live-source` public Edge Function resolves the routed provider,
discovers the current/upcoming embeddable YouTube broadcast and returns a
COT-shaped external stream record. It never returns the API key.

### YouTube quota note

YouTube search has its own daily quota bucket. Before production deployment,
add a shared database-backed source cache so discovery happens centrally rather
than once per app visitor/Edge isolate. The migration should make refresh cadence
configurable. A manually pinned video ID can be added later as an immediate
fallback without changing the player contract.

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

1. creates a COT `live_streams` row through `streaming-broadcasts`;
2. receives an ephemeral Agora channel identity;
3. requests a publisher grant through `streaming-rtc-session`;
4. joins from the in-app Live Media Studio;
5. COT marks the stream live when the publisher successfully joins.

A viewer:

1. opens an Expression live stream;
2. COT validates `can_access_stream`;
3. COT issues a short-lived subscriber grant;
4. the app joins Agora in audience mode.

### Mandatory Agora security setting

Agora Co-host token authentication must be enabled in Agora Console before
Expression Live becomes ready. COT treats the administrator confirmation
`cohostAuthenticationEnabled=true` as a launch gate. Without it, subscriber
tokens are not considered sufficiently restrictive for Expression broadcasts.

## Mux

Do not delete the existing Mux adapter. It remains provider-agnostic infrastructure
for a future funded option. Platform Administration can disable the provider.
With explicit YouTube/Agora routing, Mux is not selected for General or Expression
unless an administrator deliberately changes those route assignments.

## Supabase work intentionally deferred

No Supabase write is part of this branch yet. When the COT Supabase connection is
available, perform these steps in order:

1. Inspect the live migration/schema/function state.
2. Create a reviewed migration that seeds/updates provider definitions for
   `youtube` and `agora` without destroying the existing Mux provider.
3. Add the shared General YouTube live-source cache needed to control API quota.
4. Review RLS/grants/advisors for any new cache/config objects.
5. Apply the migration.
6. Deploy only the required functions:
   - `general-live-source`
   - `streaming-rtc-session`
   - `streaming-broadcasts`
   - `stream-access`
   - `platform-streaming`
   - plus shared-code consumers if Supabase deployment packaging requires it.
7. Configure provider credentials in Platform Administration.
8. Test one public YouTube General stream and one private Expression Agora stream.
9. Run security/performance advisors again.

## Mobile build boundary

Agora and YouTube native playback introduce native dependencies. After this work
is merged, a fresh Android/iOS binary is required; this cannot be delivered only
as an Expo OTA update.

Before merge, regenerate `package-lock.json` for the new mobile dependencies and
run the repository mobile/admin typechecks plus web/native build checks.
