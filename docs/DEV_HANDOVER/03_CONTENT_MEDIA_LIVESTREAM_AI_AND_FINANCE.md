# 03 — Content, Media, Livestream, AI and Finance

## Content platform architecture

The platform evolved beyond a simple church CMS. It now includes a governed consumer content/media ecosystem.

A core architecture concept is the `content_items` supertype with typed content domains such as:

- social posts
- reels
- long-form videos / Watch
- sermons
- live streams

This shared content layer should provide consistent tenancy, visibility, publishing lifecycle, author identity, search and engagement.

Do not remove this architecture casually.

## Core content invariants

### Follow ≠ Membership

Following is a public-consumer relationship. Membership is formal church affiliation and a security/access relationship.

### Sermon ≠ Media Format

A sermon is a semantic ministry content category. It may be audio-only, video-only, dual-format or sourced from a live recording.

### Video ≠ Livestream

Prerecorded long-form media and live broadcasting have different lifecycles, provider mechanics and UX.

### Reel ≠ Livestream Clip

A Reel may be created from a live recording, but once created it is an independent short-form content entity.

### Media Asset ≠ Content Item

Media assets represent files/renditions/transcoding state. Content items represent domain content and publishing state.

### AI Assistance ≠ Authorization

AI may create drafts or metadata, but does not possess publishing authority.

## Content visibility

Supported conceptual visibility includes:

- public
- organisation
- expression/legacy branch
- group
- private

Backend access rules must enforce the selected visibility.

## Publishing lifecycle

Use explicit states where appropriate, for example:

- draft
- processing
- review
- scheduled
- published
- archived

Existence in the database does not imply publication.

## Engagement layer

Shared engagement can include:

- reactions
- threaded comments/replies
- bookmarks
- playback progress
- moderation reports

Keep these shared across content types where the existing architecture supports that, rather than creating incompatible engagement tables per media type.

## Playback progress

Playback progress should be server-persisted where cross-device continuation matters.

This enables experiences such as:

- Continue Watching
- Continue Listening

Do not rely only on local component state.

## Reels

Reels are short-form vertical media designed for immersive swiping.

A Reel may contain:

- creator/expression attribution
- caption
- media asset
- audio attribution
- reactions
- comments
- bookmark
- share
- Follow where relevant

Never hardcode creator/expression names in the UI.

## Watch / Long-form video

Watch is a separate long-form media destination for content such as:

- teachings
- Bible studies
- conferences
- worship sessions
- documentaries
- interviews
- testimonies

Watch should support high-quality long-form playback, description, chapters, collections/playlists, progress, related content and engagement where enabled.

Do not force all long-form video into the Sermon domain.

## Sermons

Sermons are ministry content with fields/concepts such as:

- title
- preacher/speaker
- sermon date
- scripture references
- topics
- expression/organisation ownership
- series
- audio asset
- video asset
- transcript
- chapters
- description
- publishing state

The UI must adapt to actual media availability:

- audio only → Listen
- video only → Watch
- both → Watch / Listen toggle

Do not show fake controls for missing media.

## Media provider abstraction

Media delivery/processing should remain provider-neutral.

Potential implementations include:

- Supabase Storage
- Mux
- Cloudflare Stream
- future providers

Provider-specific details belong behind adapters/services, not scattered across product UI.

## Media lifecycle

Conceptual processing lifecycle:

`Upload Intent → Uploading → Uploaded → Processing → Ready`

or:

`Failed`

Production upload UX must expose real progress/error state. Do not use fake upload modals.

## Media upload flow

Expected pattern:

1. Client requests an upload intent/session.
2. Backend resolves appropriate provider.
3. Client uploads using a short-lived authorized grant.
4. Backend/provider tracks processing state.
5. Signed provider webhook confirms processing/rendition availability.
6. Media asset transitions to ready.
7. Playback info is resolved safely at runtime.

## Livestreaming philosophy

Real livestreaming uses third-party video infrastructure.

Do not attempt to build a global transcoding/CDN network inside the application.

Third-party provider handles heavy video infrastructure such as:

- ingest
- transcoding
- adaptive bitrate
- playback delivery
- recording infrastructure
- provider-level health

Our platform handles the church/domain workflow.

## Streaming provider abstraction

Never hardcode the product to Mux.

Mux may be the current/first adapter, but architecture remains:

`Church User → Internal Livestream Service → Provider Resolver/Registry → Streaming Provider Adapter → Third-party Provider`.

Future providers must be possible without rewriting all screens/backend domains.

## Platform Admin streaming responsibility

Platform Admin manages streaming infrastructure:

- provider registry
- provider credentials/secret references
- enable/disable
- provider health
- webhook health
- quotas
- global stream limits
- global policy
- recording capabilities
- technical diagnostics
- emergency termination / abuse enforcement

Platform Admin does not routinely create the actual church broadcast.

## Organisation/expression streaming responsibility

Authorised church media roles manage their own broadcasts.

Production flow:

1. Media user opens scoped Media/Leadership tools.
2. Creates/schedules a livestream.
3. Associates it with the correct expression/service/event.
4. Backend verifies capability and resource scope.
5. Backend selects configured provider.
6. Provider provisions stream/ingest.
7. Sensitive encoder credentials are shown only to authorised operator.
8. OBS/mobile/hardware encoder connects.
9. Signed provider webhooks update internal state.
10. Members watch through the church application.
11. Authorised operator ends stream.
12. Recording processes.
13. Recording becomes available.

## Livestream states

Normalize provider states into internal domain states such as:

- draft
- scheduled
- provisioning
- ready
- live
- reconnecting
- ended
- processing
- recording_ready
- failed
- cancelled

Raw provider state may be stored separately where useful.

## Recording to sermon

A finished recording must not automatically become a published sermon.

Correct workflow:

`Recording Ready → Sermon Draft → Metadata/Review → User with sermons.publish → Published`.

Livestream operation permission does not automatically imply sermon publishing authority.

## Stream secrets

Protect:

- stream key
- RTMP/SRT endpoint details
- provider credentials
- playback signing secrets
- webhook secrets

Only authorised operators/services receive sensitive ingest information.

## AI architecture

AI is provider-neutral.

Concept:

`AI Gateway → Capability Router → Provider Adapter → OpenAI/Gemini/Anthropic/Future Provider`.

Never hardcode all AI behavior to one vendor.

## AI capabilities

Possible capabilities include:

- transcription
- captions
- summarisation
- scripture extraction
- topic extraction
- chapter generation
- highlight suggestions
- devotional drafting
- announcement drafting
- content tagging
- semantic search support

Different providers/models may have different capabilities; route by capability rather than pretending every model is identical.

## Human-in-the-loop AI

AI output affecting theological or public church content should generally remain draft/review until an authorised user approves it.

AI must not autonomously publish sermons, pastoral guidance or public content merely because generation succeeded.

## AI privacy

Do not automatically send private pastoral/counselling/prayer data to external AI providers. Any use of sensitive data with AI must be intentionally designed, permitted and policy-compliant.

## AI secrets

Ordinary church users do not manage raw OpenAI/Gemini/Anthropic keys. Provider credentials belong to trusted platform infrastructure.

## Creator / Ministry Studio

Creator Studio is for authorised church content creators.

Potential actions include:

- create social post
- upload Reel
- upload Watch video
- create sermon
- monitor processing queue
- manage drafts
- publish according to capability
- moderate content/comments where authorised

Studio is permission-gated and must not appear to every authenticated user.

## Giving and finance

Giving is a real production financial domain.

Possible flows include:

- campaigns/categories
- donation intents
- provider payment
- provider event verification
- donation finalization
- receipts
- refunds
- finance summaries
- reconciliation

Do not mark a donation successful because the client says the checkout returned success.

Provider/server verification is authoritative.

## Payment provider abstraction

Payment infrastructure should remain provider-neutral.

Platform Admin manages provider configuration and technical health.

Church finance roles use scoped church finance/giving workflows.

Platform Admin is not the church treasurer.

## Finance permissions

Finance access is independent from other leadership capabilities.

Examples:

- a Media Leader should not automatically see finance
- a Finance Lead should not automatically operate streams

Use explicit database permissions and tenant scope.

## Giving verification flow

Production flow concept:

`Campaign/Category → Donation Intent → Payment Provider → Signed/Verified Provider Event → Donation Finalized → Receipt → Reporting/Reconciliation`.

Test retries, duplicate events, failures and partial refund behavior where supported.

## Prayer and pastoral confidentiality

Prayer/pastoral data is sensitive and must remain separate from ordinary social content.

Privacy may include:

- pastoral team only
- prayer team
- explicitly selected scope
- public only after approval

Never default confidential prayer content to public.

Platform Admin should not routinely see confidential prayer/counselling records solely because it administers the software.