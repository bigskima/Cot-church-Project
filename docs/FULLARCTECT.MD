# Global Church Digital Operating System — Master Architecture & Content Platform Blueprint

---

## 1. Executive Architectural Blueprint & Philosophy

The **Global Church Digital Operating System** is a unified, multi-tenant digital platform built to serve the global church through digital ministry, community fellowship, long-form teaching, short-form inspiration, real-time live broadcasting, secure giving, pastoral care, and administrative governance.

The platform is **not a narrow church CMS** or simple management tool with posts attached. It combines the strongest consumer interaction patterns from modern media platforms:
* **YouTube Interaction Strengths:** Polished long-form video playback, chapter navigation, searchable transcripts, sermon series, thematic collections/playlists, continue watching history, channel/expression identity, and related video discovery.
* **Instagram Interaction Strengths:** Visual storytelling, rich media galleries, full-screen vertical swipe Reels, expressive reactions, bookmarks, polished media presentation, and expression brand presence.
* **Twitter/X Interaction Strengths:** Rapid social discourse, threaded conversations and replies, author/expression verified identities, real-time updates, quotes, and community engagement.

All of these patterns are delivered within a **strictly governed, tenant-isolated, church-centered architecture** that honors:
1. **Platform Admin Governance:** Global safety, provider enablement, global tenant lifecycle, and system resilience.
2. **Organization Authority:** Independent legal and spiritual church entities with their own policies, providers, branding, and expressions.
3. **Expression Authority:** Campus/branch-level ministry execution, local leaders, local groups, and community life.
4. **Public vs. Scoped vs. Private Visibility:** Open discovery for unauthenticated guests, personalized follows for authenticated users, and confidential member spaces for verified congregation members.

```
                                 GLOBAL CHURCH PLATFORM
                                           │
         ┌──────────────────┬──────────────┼──────────────┬──────────────────┐
         │                  │              │              │                  │
    SOCIAL POSTS          REELS         VIDEOS         SERMONS             LIVE
         │                  │              │              │                  │
    Text/Image/Video      Short          Long           Audio              Real-time
    Conversations         Vertical       Form           and/or             Broadcasts
                          Video          Watch          Video
         │                  │              │              │                  │
         └──────────────────┴──────────────┼──────────────┴──────────────────┘
                                           │
                                 VISIBILITY & TENANCY
                                           │
                                      Organization
                                           ↓
                                       Expression
                                           ↓
                          Public / Scoped / Group / Private
```

---

## 2. Core Architectural Distinctions

To ensure system integrity and prevent architectural drift, the following invariants are strictly enforced:

| Invariant | Principle |
| :--- | :--- |
| **FOLLOW ≠ MEMBERSHIP** | Following is an identity-level preference to receive public updates from an organization, expression, or leader. Membership is formal affiliation unlocking private announcements, departments, groups, and pastoral care. |
| **SERMON ≠ MEDIA FORMAT** | A sermon is a semantic ministry content category, not a file extension. It can be audio-only, video-only, audio + video, or converted from a live broadcast recording. |
| **VIDEO ≠ LIVESTREAM** | Prerecorded on-demand watch videos and real-time broadcasts are distinct domain entities with different lifecycles and playback mechanics. |
| **REEL ≠ LIVESTREAM CLIP** | Reels are standalone, prerecorded short-form vertical videos with dedicated creator attribution and action rails. |
| **PUBLIC TITLE ≠ SECURITY ROLE** | Displaying "Lead Pastor" on a public profile does not grant RBAC capabilities. Access is granted solely through database-backed capability permissions (e.g., `sermons.create`, `posts.publish`). |
| **MEDIA ASSET ≠ CONTENT ITEM** | Media assets represent normalized physical files, renditions, and transcoding states. Content items represent published domain entities with visibility, author, and tenant scope. |
| **AI ASSISTANCE ≠ AUTHORIZATION** | AI assists in transcription, chaptering, and study notes, but generated theological content remains in `draft` until reviewed and approved by authorized ministry staff. |

---

## 3. Universal Content Supertype & Typed Subtypes

All consumer and ministry content inherits from a single authoritative supertype table: `content_items`. This ensures consistent access control, search indexing, tenant scoping, and universal engagement.

```
                              content_items (Supertype)
                               ├── id (UUID)
                               ├── organization_id (FK)
                               ├── expression_id (FK, nullable)
                               ├── group_id (FK, nullable)
                               ├── author_profile_id (FK)
                               ├── content_type (enum: post, reel, video, sermon, live_stream)
                               ├── visibility (enum: public, organization, branch, group, private)
                               ├── status (enum: draft, processing, review, scheduled, published, archived)
                               ├── published_at (timestamptz)
                               └── created_at / updated_at
                                           │
         ┌──────────────────┬──────────────┼──────────────┬──────────────────┐
         │                  │              │              │                  │
    social_posts          reels          videos        sermons          live_streams
    ├── body            ├── caption    ├── title      ├── preacher      ├── status
    ├── media[]         ├── media_     ├── media_     ├── audio_asset   ├── provider
    └── reactions       │   asset_id   │   asset_id   ├── video_asset   └── playback_
                        └── audio_     ├── category   ├── chapters          url
                            metadata   └── chapters   └── scriptures
```

### Visibility Rules
* **`public`**: Discoverable and viewable by anyone, including unauthenticated guests.
* **`organization`**: Visible only to active members of the owning organization.
* **`branch` (Expression)**: Visible only to active members assigned to that specific expression.
* **`group`**: Visible only to verified members of the specific target group (requires non-null `group_id`).
* **`private`**: Visible only to author and authorized moderators/publishers.

---

## 4. Flexible Ministry Sermon Architecture

Sermons represent the theological and spiritual teaching archive of the church. A sermon is defined by its ministry context, scriptures, and preacher rather than its media encoding.

### Source of Truth
* **Authoritative Persisted References:** `audio_asset_id` and `video_asset_id` reference normalized records in `media_assets`.
* **Derived Runtime Fields:** `audio_url` and `video_url` are dynamically resolved at request time through `get_media_playback_info` or Edge APIs, avoiding stale or unmanaged URLs.
* **External Media Hosting:** External sermon recordings (YouTube, Vimeo, custom CDNs) are modeled in `media_assets` with `source_type = 'external'`, storing validated `external_provider`, `external_reference`, and `canonical_external_url`.

### Adaptive Playback Experience
* **Audio-Only Upload:** Mobile and Web render an interactive `AudioPlayer` with waveform scrubbing, 15s skip, variable speed (1.0x, 1.25x, 1.5x, 2.0x), and scripture badges.
* **Video-Only Upload:** Mobile and Web render `VideoPlayer` with 16:9 canvas, scrubbing, and interactive timestamp chapters.
* **Dual Format (Audio + Video):** Mobile and Web render `MediaPlayer` featuring a seamless **Watch Video / Listen Audio** pill toggle, allowing users to switch formats without losing content context.

---

## 5. Long-Form Video / Watch Platform & Collections

The **Watch Platform** is a dedicated destination for long-form church media including:
* Expository Teachings & Bible Studies
* Worship Encounters & Concerts
* Annual Conferences & Conventions
* Documentaries & Church Heritage Films
* Pastoral Interviews & Conversations
* Faith Testimonies & Highlights

### Content Collections & Playlists (`ContentCollection`)
To support organized viewing, content items can be grouped into ordered collections:
* **Video Playlists:** Curated playlists for conferences and teachings.
* **Sermon Series:** Thematic preaching series across weeks or months.
* **Conference Collections:** Multi-day conference sessions (e.g., *2026 Convention: Opening, Keynote, Worship Night, Closing*).
* **Teaching Modules:** Progressive spiritual growth courses.

Each collection maintains tenant ownership, visibility, artwork, and an ordered list of `content_items`.

---

## 6. Short-Form Vertical Reels Platform

**Reels** provide short-form spiritual encouragement, sermon clips, worship moments, and community highlights:
* **Presentation:** Full-screen 9:16 vertical video with smooth vertical swipe navigation.
* **Action Rail:** Right-side vertical interaction bar with like count, comment count, bookmark button, and native share.
* **Creator Header:** Expression logo/avatar, expression name, and an instant **Follow** button.
* **Audio Attribution:** Track title and artist badge at the bottom of the reel.
* **Lifecycle:** Prerecorded social video created either directly in Creator Studio or clipped from an existing live recording.

---

## 7. Normalized Media Pipeline & Provider Abstraction

Media assets are treated as first-class domain entities. The system decouples raw upload and playback from vendor-specific implementations through the `MediaProvider` interface.

```
                           MediaProvider Interface
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
 Internal Storage Adapter       Mux Video Adapter          Cloudflare Stream
 (Direct Supabase Storage)      (Direct Upload + HLS)      (Future Provider)
```

### Media Lifecycle States
```
 [ Upload Intent ] ──> [ Uploading ] ──> [ Uploaded ] ──> [ Processing ] ──> [ Ready ]
                                                                   │
                                                                   └──> [ Failed ]
```

### Media Processing Workflow
1. **Upload Intent:** Client requests upload session via `content-media` API.
2. **Direct Upload:** Client uploads directly to the provider ingest endpoint using a short-lived grant.
3. **Completion & Ingest:** Client notifies backend, transitioning state to `processing`.
4. **Idempotent Webhook:** Provider sends signed webhook upon transcode completion. Backend updates renditions (`video_stream`, `audio_stream`, `thumbnail`), tracks (captions), and duration, transitioning state to `ready`.
5. **Playback Resolution:** Clients resolve signed playback streams dynamically with TTL grants.

---

## 8. Decoupled Follow System vs. Membership

The platform cleanly separates public discovery from formal church membership:

```
                      ANONYMOUS GUEST
                            │
                   (Public Discovery)
                            │
               Can browse feeds, watch videos,
               listen to sermons, discover leaders
                            │
                            ▼
                   AUTHENTICATED USER
                            │
                   (Follow Relationship)
                            │
               Can follow Orgs, Expressions & Leaders,
               bookmark items, comment, sync progress
                            │
                            ▼
                   EXPRESSION MEMBER
                            │
                   (Formal Membership)
                            │
               Unlocks private notices, pastoral care,
               groups, departments & member events
```

### Follow Schema Invariant
The `follows` table strictly enforces single-target foreign key integrity via check constraint `num_nonnulls(organization_id, expression_id, leader_id) = 1`.

---

## 9. Universal Engagement & Playback Progress Layer

All social interactions target `content_items(id)` directly with strict foreign-key integrity:
* **Reactions (`content_reactions`):** Scoped reactions (`like`, `love`, `pray`, `celebrate`, `amen`, `support`).
* **Threaded Comments (`content_comments`):** Supports recursive conversations via `parent_comment_id`. Includes soft moderation (`is_hidden`).
* **Bookmarks (`content_bookmarks`):** Personal saved library accessible from user profile.
* **Playback Progress (`content_playback_progress`):** Server-persisted watch/listen progress with automatic completion threshold (>= 90% duration) powering "Continue Watching" across devices.
* **Moderation Reports (`content_moderation_reports`):** In-app user reporting for posts, reels, videos, or comments, triaged by organization/expression moderators.

---

## 10. Creator & Ministry Studio

Authorized staff and volunteer creators access a dedicated mobile **Creator Studio** (`app/studio/index.tsx`):
* **Capability Controlled:** Access is determined by granular capability permissions (`posts.create`, `reels.create`, `videos.create`, `sermons.create`, `media.upload`), not hardcoded titles.
* **Publishing Actions:**
  * **Create Post:** Rich text, gallery images, video attachments, audience scope.
  * **Upload Reel:** Vertical 9:16 video, caption, audio attribution.
  * **Upload Video:** 16:9 watch video, category, chapter timestamps, series link.
  * **Create Sermon:** Preacher name, sermon date, scripture references, audio/video assets.
* **Workspace Management:** Track drafts, monitor background media transcoding queue, review published analytics, and moderate comments.

---

## 11. Provider-Neutral AI Gateway Integration

The AI Gateway connects to the content pipeline to accelerate ministry workflows while maintaining human oversight:

```
 Upload Sermon / Video
          │
          ▼
 AI Gateway Capability Router
 (OpenAI / Gemini / Claude)
          │
          ├── Transcription & Captions
          ├── Expository Study Summary
          ├── Scripture & Topic Extraction
          └── Suggested Highlight Clips
          │
          ▼
 ai_content_drafts (review_status = 'draft')
          │
          ▼
 Ministry Human-in-the-Loop Review
 (Approved / Rejected)
          │
          ▼
 Public Sermon Synthesis Display
```

---

## 12. Mobile UX & Design System Foundation

The user interface implements a luxury, content-driven experience:
* **Palette:** Sanctuary Warm Brown & Gold (`palette.brown900 = #140C07`, `palette.brown800 = #2E1C11`, `palette.gold = #F59E0B`, `palette.yellow = #FDE68A`, `palette.surfaceDark = #0D0805`).
* **Theme Modes:** Seamless dynamic support for **Dark**, **Light**, and **System** themes.
* **Navigation Architecture:**
  1. **Home (`(tabs)/home`):** Live gather banner, content feed, reels carousel, continue watching progress, latest sermons, watch highlights, upcoming events, and expression discovery.
  2. **Discover (`(tabs)/discover`):** Server-side universal search across All, Sermons, Videos, Reels, Expressions, Leaders, and Events; sermon series collections; leader directory.
  3. **Reels (`(tabs)/reels`):** Immersive vertical swipe feed with action rail, creator attribution, and threaded comments.
  4. **Live (`(tabs)/live`):** Current and scheduled live sanctuary broadcasts with low-latency chat and digital altar calls.
  5. **Watch Catalog (`/watch` & `/watch/[id]`):** Dedicated long-form watch library with categories, playlists, chapters, and progress sync.
  6. **Sermon Teaching (`(tabs)/discover/sermon/[id]`):** Adaptive audio/video player, transcript excerpts, approved AI synthesis, and scripture cards.
  7. **Expression Profile (`/expression/[id]`):** Public identity, follow action, watch videos, reels, sermons, leadership, and private Member Space.
  8. **Creator Studio (`/studio`):** Capability-authorized publishing and media queue management.
  9. **Profile (`(tabs)/profile`):** Digital member pass, following list, saved bookmarks, giving receipts, prayer requests, and appearance settings.

---

## 13. Edge API & RPC Directory

| Endpoint | Methods | Auth Scope | Capabilities / Purpose |
| :--- | :--- | :--- | :--- |
| `public-content` | GET | Public | Retrieve public feeds, reels, videos, sermons, leaders, streams, events, giving, and multi-entity search. |
| `content-media` | GET, POST | Optional / Required | Dynamic playback info (`get_media_playback_info`), upload intent sessions, and upload completion. |
| `creator-studio` | GET, POST | Required | Studio overview (drafts, queue), atomic publishing for posts, reels, and videos. |
| `sermons` | GET, POST, PATCH | Optional / Required | List sermons, filter by series, create flexible sermons, convert live recording to sermon, update chapters/scriptures. |
| `engagement` | GET, POST | Optional / Required | Retrieve comments; post comments/replies, toggle reactions, toggle bookmarks, sync playback progress, submit moderation reports. |
| `follows` | GET, POST | Required | Retrieve personal following list; follow/unfollow organizations, expressions, and leaders. |
| `social-feed` | GET, POST | Scoped Member | Authenticated feed across public, organization, branch, group, or private visibilities. |
| `stream-access` | POST | Member / Permitted | Request signed playback tokens and register live attendance. |
| `ai-gateway` | POST | `ai.use` | Capability-routed LLM requests with fallback and token budget controls. |
| `ai-review` | GET, POST | `ai.review` | Human-in-the-loop review for AI-generated sermon and post drafts. |

---

## 14. Delivery Roadmap & Implementation Status

```
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ Phase 1: Platform & Security Core                         [ COMPLETE ✓ ]  │
 │ Multi-tenancy, PostgreSQL RLS, RBAC, Audit, Identity, Sessions            │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ Phase 2: Church Operations & Engagement                   [ COMPLETE ✓ ]  │
 │ Events, Attendance, Groups, Volunteers, Prayers, Notifications            │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ Phase 3: Finance, Intelligence & Media Core               [ COMPLETE ✓ ]  │
 │ Giving, Manual Bank Giving, Receipts, AI Gateway, Mux Live Streaming       │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ Phase 4: Master Content & Social Ecosystem                [ COMPLETE ✓ ]  │
 │ content_items Supertype, Normalized Media Pipeline, Reels, Watch Catalog, │
 │ Flexible Sermons, Follow System, Creator Studio, Universal Search         │
 └───────────────────────────────────────────────────────────────────────────┘
```
