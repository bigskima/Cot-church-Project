# CHURCH DIGITAL PLATFORM — FULL PRODUCTION ARCHITECTURE & DEVELOPMENT HANDOFF

You are continuing development of an existing **Church Digital Platform**.

This project is completely separate from SKIMA. Do not mix SKIMA infrastructure, database tables, repositories, credentials, architecture, branding, business logic, or services into this project.

Some work has already been completed.

Your first responsibility is therefore to inspect the existing repository, database, migrations, frontend, backend, dependencies, environment configuration, and current architecture before making changes.

Do **not** rebuild working systems unnecessarily.

Preserve valid existing implementation, improve incomplete implementation, replace weak/prototype implementation where necessary, and continue toward a complete production system.

---

# 1. PRIMARY DEVELOPMENT DIRECTIVE

THIS IS NOT A PROTOTYPE.

THIS IS NOT AN MVP MOCKUP.

THIS IS NOT A DEMONSTRATION APPLICATION.

THIS IS A PRODUCTION SOFTWARE BUILD.

Every implementation decision should prioritize:

* production reliability
* scalability
* security
* maintainability
* observability
* proper database design
* permissions
* real backend integration
* failure recovery
* real user flows
* proper loading/error/empty states
* auditability
* accessibility
* performance
* extensibility
* deployment readiness

Do not create fake functionality simply to make a screen appear complete.

Do not use hardcoded data when the information belongs in the database or configuration system.

Do not leave important features using mock arrays, temporary JSON, local state, static role definitions, fake livestream sessions, fake analytics, fake notifications, or placeholder API responses.

If a feature is presented to users as functional, it must actually work.

---

# 2. EXISTING PROJECT — CONTINUE, DO NOT RESTART

Before implementing major changes:

1. Inspect the existing repository.
2. Understand the existing folder structure.
3. Inspect existing database migrations.
4. Inspect the current Supabase schema.
5. Inspect authentication and role implementation.
6. Inspect existing mobile screens.
7. Inspect the admin application.
8. Inspect current API/server functions.
9. Inspect environment configuration.
10. Inspect existing integrations.
11. Identify completed, partially completed, broken, duplicated, or prototype-only components.

Create new architecture only where required.

Do not delete working production-grade implementation simply because you would have implemented it differently.

Migrate/refactor gradually where necessary.

---

# 3. PRODUCT VISION

The platform should become the central digital infrastructure through which a church organisation can operate its digital ecosystem.

It should support:

* central church administration
* church expressions/branches
* pastors and leaders
* departments
* ministries
* groups
* members
* services
* events
* livestreaming
* sermons/media
* announcements
* communication
* notifications
* giving
* attendance
* membership
* discipleship
* volunteer coordination
* pastoral workflows
* prayer requests
* testimonies
* church content
* digital resources
* AI-assisted church administration and content workflows

The architecture must allow more capabilities to be added later without rebuilding the core platform.

---

# 4. GOVERNANCE MODEL

The platform follows a hierarchical governance structure.

## Level 1 — Platform Administration

This is the highest system authority.

The Platform Admin web application manages the entire ecosystem.

Platform administration controls:

* organisations
* church expressions
* permissions
* platform configuration
* users
* roles
* feature availability
* integrations
* livestream providers
* AI providers
* security settings
* audit logs
* system configuration
* content governance
* application settings
* reporting
* moderation
* operational tools

Platform admins should not need to edit database rows manually for ordinary operations.

---

# 5. CENTRAL CHURCH AUTHORITY

Below the system/platform administration layer is the central church organisation.

Example hierarchy:

Central Church Authority

→ Expression A
→ Expression B
→ Expression C
→ future expressions

The system must NOT hardcode the number of expressions.

Expressions must be created dynamically.

Each expression may have:

* leaders
* members
* departments
* ministries
* groups
* services
* events
* livestreams
* announcements
* resources
* media
* attendance
* volunteers
* local configuration

The Central Church Authority must be able to control what an expression can manage independently.

---

# 6. CHURCH EXPRESSIONS

An expression represents a church branch/campus/location/community.

Each expression should have its own:

* profile
* branding where permitted
* location
* leaders
* departments
* groups
* members
* events
* services
* livestreams
* media
* announcements
* attendance records
* volunteer structure
* content
* notification targeting
* analytics

However, expressions remain subordinate to the central church authority.

Platform governance must therefore support hierarchical permissions rather than isolated independent tenants.

---

# 7. MULTI-TENANCY / ORGANISATIONAL BOUNDARIES

Design this as a proper organisation-aware system.

Do not simply add `church_id` randomly to screens.

Backend authorization must understand organisation hierarchy.

Potential hierarchy:

platform

→ organisation

→ expression

→ department/ministry/group

→ membership/leadership assignment

Resources should carry appropriate organisational ownership.

Where applicable, support:

* organisation_id
* expression_id
* department_id
* group_id

but only where semantically appropriate.

Use relational models, not duplicated metadata blobs.

---

# 8. USER TYPES

The platform should support different categories of users without requiring separate applications for every role.

Examples include:

* member
* guest
* pastor
* expression pastor
* church leader
* department leader
* ministry leader
* group leader
* volunteer
* media team
* finance personnel
* communications personnel
* moderator
* church administrator
* central church administrator
* platform administrator
* super administrator

Do not build authorization using simple frontend checks like:

`if role === "admin"`.

Use a proper permission/capability system.

---

# 9. AUTHORIZATION ARCHITECTURE

Use RBAC with scoped permissions/capabilities.

Example capabilities:

* members.read
* members.manage
* members.invite
* expressions.read
* expressions.manage
* departments.manage
* groups.manage
* events.create
* events.manage
* livestream.create
* livestream.manage
* livestream.moderate
* sermons.publish
* announcements.publish
* notifications.send
* attendance.manage
* giving.read
* giving.manage
* finance.read
* prayer.manage
* testimonies.moderate
* roles.manage
* integrations.manage
* settings.manage
* audit.read

Capabilities must also have scope.

For example:

A department leader may have:

`members.read`

but only within their department.

An expression administrator may manage users within their expression but not another expression.

A central administrator may operate across all expressions.

Platform administrators operate at system scope.

Enforce authorization on the backend/database/API layer.

Frontend authorization is only UX gating.

---

# 10. AUTHENTICATION

Use the existing authentication architecture where valid.

Supabase Auth may provide authentication.

Production requirements should include:

* secure signup
* secure login
* password reset
* email verification where required
* session refresh
* logout
* device/session management where practical
* account status
* suspended accounts
* invitations
* role assignment
* membership assignment

Do not make role claims trusted solely because they exist in frontend state.

---

# 11. DATABASE

Supabase PostgreSQL is the primary backend/database.

The database should be treated as part of the production architecture.

Use proper migrations.

Never manually modify production schema without migration history unless an emergency repair procedure explicitly requires it.

Important systems should include appropriate:

* primary keys
* foreign keys
* indexes
* unique constraints
* check constraints
* timestamps
* soft deletion where appropriate
* audit fields
* RLS
* triggers only where justified
* immutable logs where required

Avoid enormous generic tables that store unrelated features as JSON.

JSONB is acceptable for flexible metadata, not as a substitute for data modelling.

---

# 12. CORE DOMAIN MODEL

The architecture should eventually support entities including:

## Identity / Organisation

* profiles
* organisations
* organisation_memberships
* expressions
* expression_memberships
* departments
* department_memberships
* ministries
* ministry_memberships
* groups
* group_memberships
* roles
* permissions
* role_permissions
* role_assignments

## Content

* posts
* announcements
* sermons
* sermon_series
* media_assets
* documents
* devotionals
* resources
* categories
* tags

## Events

* events
* event_sessions
* event_registrations
* event_attendance
* service_schedules
* recurring_service_rules

## Livestream

* livestream_channels
* livestream_sessions
* livestream_provider_configs
* livestream_provider_accounts
* livestream_recordings
* livestream_chat/messages if supported
* livestream_viewer_sessions where required
* livestream_events
* livestream_moderation

## Membership

* member_profiles
* membership_status
* membership_history
* family/household relationships where needed
* membership pathways
* membership notes with strong permissions

## Attendance

* service_attendance
* event_attendance
* check_in_sessions
* check_in_records
* attendance_methods

## Communication

* notifications
* notification_templates
* notification_deliveries
* notification_preferences
* communication_campaigns
* audience_segments

## Giving

When implemented:

* giving_transactions
* giving_categories
* payment_provider_transactions
* payment_webhook_events
* refunds
* reconciliations

Financial architecture must be auditable.

## Prayer / Pastoral

* prayer_requests
* prayer_categories
* prayer_assignments
* prayer_updates
* testimonies
* pastoral_followups

Sensitive pastoral information must have stricter authorization than normal church content.

## Volunteers

* volunteer_profiles
* volunteer_teams
* volunteer_assignments
* volunteer_schedules
* availability
* check-ins

## Platform

* platform_configurations
* feature_flags
* provider_configs
* integrations
* audit_logs
* system_events
* jobs
* webhook_events

Exact names may differ according to the existing schema.

Do not duplicate tables unnecessarily if equivalent structures already exist.

---

# 13. MOBILE APPLICATION

The primary member/leader application must use:

**Expo + React Native**

Continue with the existing Expo/React Native application.

Use Expo Router where it is already established or where migration is appropriate.

The mobile application must be production quality.

Include proper:

* navigation
* deep linking
* authentication persistence
* splash screen
* error boundaries
* loading states
* empty states
* retry states
* network failure handling
* offline-friendly behaviour where reasonable
* caching
* refresh logic
* forms
* validation
* keyboard behaviour
* safe areas
* accessibility
* permissions
* responsive layouts
* push notification handling
* universal/app links where applicable

Do not ship screens connected to fake data.

---

# 14. ROLE-AWARE MOBILE EXPERIENCE

There should not necessarily be a separate application for every church role.

The same application can expose capabilities based on user permissions.

Example:

A normal member may see:

* Home
* Church
* Live
* Events
* Sermons
* Giving
* Groups
* Prayer
* Profile

A leader may additionally receive:

* Leader tools
* attendance
* member management
* group management
* event management
* announcements
* volunteer tools

A pastor may have additional pastoral workflows.

These are examples, not hardcoded navigation requirements.

Navigation should derive from available capabilities where appropriate.

---

# 15. ADMIN WEB APPLICATION

The admin environment is an important product in its own right.

It must not feel like a raw CMS/database manager.

Build it as an operational platform.

The admin interface should eventually support:

* Dashboard
* Expressions
* Members
* Leadership
* Departments
* Ministries
* Groups
* Services
* Events
* Livestreaming
* Sermons
* Media
* Announcements
* Notifications
* Volunteers
* Prayer Requests
* Testimonies
* Attendance
* Giving
* Reports
* Users
* Roles & Permissions
* Integrations
* AI
* Livestream Providers
* Feature Flags
* Platform Settings
* Audit Logs

The precise menu should be permission-aware.

---

# 16. LIVE STREAMING — IMPORTANT

Live streaming must mean **actual livestreaming**.

Do not simulate it.

Do not create an admin page where staff paste a random video URL and call that the livestream platform.

Do not use a fake countdown and embedded prerecorded file.

We are using a **third-party livestream infrastructure/provider** for actual video transport.

The Church Digital Platform is responsible for the management experience around that provider.

---

# 17. LIVE STREAM PROVIDER ARCHITECTURE

DO NOT tightly couple the platform to one vendor.

Build a provider abstraction.

Conceptually:

`LiveStreamingProvider`

with operations such as:

* createChannel()
* createStream()
* createBroadcast()
* getIngestCredentials()
* startStream()
* stopStream()
* getStreamStatus()
* getPlaybackUrl()
* getViewerToken()
* getRecording()
* listRecordings()
* deleteRecording()
* getAnalytics()
* processWebhook()

The exact methods depend on providers and implementation.

Possible third-party providers may include video infrastructure companies or cloud streaming services.

The platform administrator should eventually be able to configure the active provider.

Configuration must be secure.

API secrets must NOT be exposed to the mobile client.

---

# 18. LIVE STREAM CONFIGURATION

Create a generic provider configuration architecture.

Example concept:

live_stream_provider_configs

* id
* provider
* name
* enabled
* environment
* encrypted_secret_reference
* configuration
* created_at
* updated_at

Never store unrestricted plaintext provider secrets where ordinary administrators can retrieve them.

Use environment/secrets infrastructure appropriately.

The database may store safe provider metadata and secret references.

---

# 19. STREAMING WORKFLOW

Example production workflow:

Church administrator creates livestream

→ selects expression/service/event

→ backend creates livestream session

→ provider adapter creates/configures third-party stream

→ provider returns ingest information

→ authorized media team receives required broadcast details

→ OBS/mobile encoder/hardware encoder sends video to provider

→ third-party provider handles actual video ingest/transcoding/distribution

→ provider playback is delivered inside church application/web experience

→ platform receives provider webhooks

→ livestream status updates in real time

→ members watch livestream

→ stream ends

→ recording becomes available if recording is enabled

→ sermon/media workflow can publish/archive recording.

This must be real.

---

# 20. LIVE STREAM STATES

Model livestream state properly.

For example:

* draft
* scheduled
* preparing
* ready
* live
* reconnecting
* ended
* processing
* available_on_demand
* failed
* cancelled

Do not assume every provider returns identical state names.

Normalize provider-specific statuses into internal statuses.

Store provider raw state separately if needed.

---

# 21. LIVE STREAM USER EXPERIENCE

Member experience should support:

* upcoming livestream
* countdown
* live badge
* video playback
* service title
* expression
* preacher/speaker
* description
* viewers where supported
* share
* reminders
* related scripture/content
* giving shortcut where appropriate
* prayer shortcut
* livestream chat/reactions if implemented
* replay after completion

Make mobile video behaviour production quality.

Handle:

* connection loss
* buffering
* stream unavailable
* provider errors
* expired playback tokens
* app backgrounding
* orientation
* picture-in-picture where supported
* reconnecting stream
* scheduled streams not started

---

# 22. LIVESTREAM MODERATION

If chat/comments/reactions are introduced:

Provide moderation capabilities including:

* delete comment
* mute user
* block user where appropriate
* slow mode where supported
* keyword filtering
* report functionality
* moderator roles
* audit history

Do not expose unrestricted chat without moderation architecture.

---

# 23. LIVE STREAM RECORDINGS

Recordings should not become disconnected files.

They should be linked to:

* livestream session
* church expression
* service/event
* speaker
* sermon
* series
* media asset

Allow administrators to turn a completed livestream recording into a published sermon/media item.

---

# 24. PROVIDER WEBHOOKS

Implement livestream provider webhooks correctly.

Requirements:

* signature verification
* idempotency
* event storage
* retry-safe processing
* unknown event handling
* auditability
* normalized internal events

Examples:

* stream.connected
* stream.started
* stream.disconnected
* stream.ended
* recording.ready
* recording.failed

Never trust unsigned webhook requests.

---

# 25. AI ARCHITECTURE

AI functionality must also be provider-agnostic.

Do not hardcode the application to OpenAI, Gemini, Claude, or one specific AI company.

Build an AI provider abstraction.

Conceptually:

`AIProvider`

with capabilities such as:

* generateText()
* summarize()
* classify()
* extractStructuredData()
* moderate()
* createEmbedding()
* transcribe() if supported
* generateImage() if eventually enabled

Provider capabilities may differ.

Use a capability registry rather than pretending every model supports everything.

---

# 26. AI PROVIDER CONFIGURATION

An administrator should eventually be able to select/configure providers such as:

* OpenAI
* Gemini
* Anthropic
* future providers

Do not expose provider API keys to the frontend.

AI calls requiring private credentials must execute through trusted backend/server functions.

---

# 27. POSSIBLE AI FEATURES

Architecture should make future AI features possible such as:

* sermon summaries
* sermon titles/descriptions
* scripture reference extraction
* announcement drafting
* event description drafting
* devotional assistance
* sermon transcription
* chapter/timestamp generation
* semantic sermon search
* member FAQ assistant
* church knowledge assistant
* content tagging
* moderation assistance
* analytics explanations
* pastoral workflow assistance

AI must assist authorised users rather than silently perform sensitive pastoral decisions.

---

# 28. EVENT-DRIVEN ARCHITECTURE

Important platform actions should produce domain/system events.

Examples:

* member.created
* member.joined_expression
* event.created
* event.registration_created
* service.started
* attendance.checked_in
* livestream.scheduled
* livestream.started
* livestream.ended
* sermon.published
* prayer_request.created
* giving.payment_confirmed

Events may trigger:

* push notifications
* emails
* analytics
* workflows
* livestream actions
* AI processing
* audit entries

Avoid tightly coupling all these behaviours inside one frontend request.

---

# 29. NOTIFICATION SYSTEM

Build notifications as a platform system rather than scattered function calls.

Potential channels:

* in-app
* push notification
* email
* SMS later
* WhatsApp later where appropriate

The architecture should support templates.

Example:

notification_templates

notification_events

notification_deliveries

notification_preferences

device_tokens

Allow targeting by:

* organisation
* expression
* department
* group
* role
* member
* event registration
* custom audience

Do not send every notification to every member.

---

# 30. PUSH NOTIFICATIONS

For Expo/React Native, implement push notifications properly.

Account for:

* device token registration
* token refresh
* multiple devices
* logout cleanup
* disabled notifications
* invalid token removal
* notification deep links
* notification categories
* delivery records where useful

---

# 31. EVENTS

Events should support:

* title
* description
* church expression
* location
* online/offline/hybrid
* start/end
* registration
* capacity
* registration deadlines
* speakers
* livestream association
* reminders
* attendance
* recurring events where appropriate
* event media
* visibility

Do not treat church service schedules and one-time events as necessarily identical business objects if requirements differ.

---

# 32. SERMONS AND MEDIA

Media should support:

* sermon
* video
* audio
* livestream replay
* series
* preacher
* date
* scriptures
* topics
* expression
* description
* transcript
* attachments
* thumbnails
* publish state
* visibility
* featured status

Support search.

Future semantic search should be possible.

---

# 33. CONTENT PUBLISHING WORKFLOW

Content can use statuses such as:

* draft
* review
* scheduled
* published
* archived

Where appropriate, support scheduled publishing.

Record who:

* created
* edited
* approved
* published
* archived

important content.

---

# 34. MEMBER MANAGEMENT

Membership must be more than Auth users.

Separate authentication identity from church membership profile where appropriate.

A person may:

* have an account
* be a guest
* become a member
* join an expression
* join groups
* lead a department
* volunteer
* attend events

Design relationships properly.

---

# 35. GROUPS / DEPARTMENTS / MINISTRIES

Do not hardcode church department names.

Admins should be able to create structures such as:

* Choir
* Media
* Youth
* Children
* Hospitality
* Prayer
* Protocol
* Evangelism

Each can have:

* leaders
* members
* announcements
* events
* resources
* schedules
* permissions

The architecture should support different churches naming them differently.

---

# 36. ATTENDANCE

Attendance architecture should eventually support several methods:

* admin check-in
* member self check-in where permitted
* QR
* event registration check-in
* leader attendance entry
* future kiosk mode

Prevent accidental duplicate attendance.

Keep source/method metadata.

---

# 37. PRAYER REQUESTS

Prayer requests can contain private information.

Support visibility such as:

* private pastoral team
* selected prayer team
* anonymous to wider audience
* public with approval

Never make prayer requests public by default unless explicitly designed that way.

Implement strong permissions.

---

# 38. GIVING / PAYMENTS

When implementing giving, use real payment provider integration.

Do not mark transactions successful from frontend callbacks alone.

Verify payments through the payment provider/backend/webhooks.

Track:

* amount
* currency
* category
* provider
* provider reference
* payer where available/permitted
* anonymous giving preference
* expression
* payment status
* verification status
* timestamps

Webhook processing must be idempotent.

Financial records should be auditable.

---

# 39. FILE STORAGE

Use controlled object storage for:

* profile images
* sermon thumbnails
* documents
* event media
* church media
* livestream-related assets

Do not create permanently public buckets for sensitive documents.

Use signed URLs for restricted content.

Validate uploads by:

* type
* size
* ownership
* authorization

---

# 40. SEARCH

Build search in a manner that can expand.

Users should eventually be able to search appropriate resources such as:

* sermons
* events
* groups
* church resources
* public members where permitted
* announcements

Authorization must apply to search results.

Do not leak restricted resources through search indexes.

---

# 41. AUDIT SYSTEM

Sensitive administrator operations should create audit logs.

Examples:

* role assignment
* permission changes
* livestream provider changes
* AI provider changes
* member suspension
* content deletion
* financial actions
* expression configuration
* feature flag changes

Audit records should capture where appropriate:

* actor
* action
* resource
* previous state
* new state
* timestamp
* organisation scope
* request/context metadata

Audit logs must not be editable by ordinary admins.

---

# 42. FEATURE FLAGS

Use a database-driven feature capability system.

This allows features to be enabled:

* globally
* per organisation
* per expression
* per environment

Examples:

* livestreaming
* giving
* groups
* AI features
* prayer
* volunteer management

Do not require redeployment simply to enable ordinary configurable features.

---

# 43. CONFIGURATION

Business/application configuration that can reasonably change should be stored through proper platform configuration.

Examples:

* church settings
* expression settings
* branding
* livestream settings
* communication settings
* registration settings
* content configuration
* feature flags

Do not hardcode these values throughout source files.

---

# 44. API / SERVER ARCHITECTURE

Sensitive operations must execute in a trusted environment.

Use:

* Supabase database/RPC where suitable
* Edge Functions/server services where appropriate
* secure provider adapters

Do not call privileged third-party services directly from mobile clients when secrets are required.

Backend interfaces should provide consistent error formats.

Use input validation.

---

# 45. ROW LEVEL SECURITY

Supabase RLS is not optional for sensitive production data.

Implement and test RLS based on:

* authenticated user
* organisation membership
* expression membership
* role assignment
* permission
* ownership
* resource visibility

Service-role access must only exist in trusted backend environments.

Never ship a service-role Supabase key inside mobile/web clients.

---

# 46. SECURITY

Production security must include:

* secret management
* RLS
* least privilege
* input validation
* API authorization
* webhook verification
* rate limiting where needed
* abuse protection
* upload validation
* protected admin routes
* CSRF protections where architecture requires
* secure cookies/tokens
* no secrets in browser bundles
* no secrets committed to Git
* dependency security awareness

Sensitive logs must not expose:

* passwords
* access tokens
* refresh tokens
* provider API secrets
* private pastoral information

---

# 47. OBSERVABILITY

Production failures must be diagnosable.

Implement appropriate:

* structured logging
* application errors
* provider error tracking
* webhook logs
* background job failure tracking
* health checks
* database monitoring
* deployment logs

Important integration calls should have request correlation IDs where practical.

---

# 48. BACKGROUND PROCESSING

Do not make users wait synchronously for long operations.

Examples that may use background jobs:

* AI transcription
* livestream recording processing
* email campaigns
* push campaigns
* analytics aggregation
* media processing
* webhook processing
* scheduled notifications

Jobs need:

* status
* retries
* max attempts
* failure reason
* timestamps
* idempotency where required

---

# 49. ANALYTICS

Build analytics from real platform events.

Possible reporting areas:

* member growth
* service attendance
* event attendance
* livestream reach
* sermon engagement
* expression growth
* volunteer participation
* giving
* communication engagement

Never display invented numbers.

Clearly distinguish unavailable analytics from zero.

---

# 50. REALTIME FEATURES

Use realtime capabilities where they genuinely improve the application.

Examples:

* livestream status
* live chat
* admin operational dashboards
* notifications
* attendance dashboards

Do not subscribe every client to every database change.

Scope subscriptions appropriately.

---

# 51. ADMIN UX

Do not expose database concepts unnecessarily to normal church administrators.

Avoid forms asking administrators to edit:

* JSON
* raw IDs
* UUIDs
* API payloads
* database enums

Create understandable interfaces.

Example:

Instead of:

`expression_id: 779127...`

show:

`Expression: Central Campus`

---

# 52. ERROR EXPERIENCE

Every major screen must support:

* loading
* success
* empty
* unauthorized
* offline/network failure
* server error
* retry

Do not leave users with endless spinners.

Long loading behaviour in the existing application must be investigated and fixed.

---

# 53. PERFORMANCE

Investigate:

* repeated database requests
* waterfall fetching
* oversized payloads
* unnecessary realtime subscriptions
* repeated image downloads
* expensive queries
* missing indexes
* N+1 queries
* unnecessary rerenders

Use pagination for large data sets.

Do not download thousands of records simply because the system currently contains few users.

---

# 54. DESIGN SYSTEM

Create/reuse consistent primitives for:

* typography
* spacing
* cards
* buttons
* forms
* modals
* bottom sheets
* alerts
* list items
* loading states
* empty states
* badges
* icons
* colours

Do not randomly redesign existing established UX.

Refactor into reusable components where duplication is becoming harmful.

---

# 55. RESPONSIVE ADMIN WEB

Admin web should work properly on normal desktop and tablet widths and remain usable on smaller screens.

Do not build layouts that only work on the developer's monitor.

---

# 56. ACCESSIBILITY

Include:

* readable text
* accessible touch targets
* semantic controls
* labels
* focus management
* keyboard support in admin web
* sufficient contrast
* screen-reader-friendly important controls

---

# 57. DEVELOPMENT ENVIRONMENTS

Maintain appropriate separation between:

* local development
* staging/preview
* production

Do not point every development environment at production services by default.

Configuration should be environment based.

---

# 58. MIGRATIONS

All schema evolution should be recorded.

Before adding migrations:

Inspect all existing migrations and remote schema.

Avoid:

* duplicate tables
* duplicate columns
* conflicting enums
* destructive migrations without review
* resetting production databases

Make migrations safe for existing data.

---

# 59. TESTING

Production-first does NOT mean avoiding tests.

It means tests exist to protect production functionality rather than replacing production implementation.

Use appropriate testing for:

* authorization
* RLS
* authentication
* critical APIs
* livestream provider adapter
* provider webhooks
* payments
* role assignment
* content publishing
* attendance
* important mobile flows
* admin workflows

Do not spend development effort building a fake test application instead of the actual product.

---

# 60. THIRD-PARTY PROVIDERS

Every important third-party integration should sit behind an adapter.

Examples:

* livestream provider
* AI provider
* email provider
* SMS provider
* push provider
* payment provider
* analytics provider
* storage/media processing provider

Do not scatter vendor-specific calls throughout screens/components.

---

# 61. PROVIDER REGISTRY

Conceptually provide something similar to:

Provider Registry

→ Live Streaming
→ Active provider

→ AI
→ Active provider/model

→ Payments
→ Active provider(s)

→ Communications
→ Email provider
→ SMS provider

Provider switching does not necessarily need to be exposed immediately to every administrator.

But the backend architecture must not require rewriting the application just to change vendors.

---

# 62. SECRETS

Provider credentials should be handled through production secrets/environment infrastructure.

Never expose keys inside:

* React Native source
* public environment variables
* browser JavaScript
* database responses
* admin API responses

If administrators enter credentials through a secure configuration interface, ensure the backend stores them using an appropriate secret management mechanism.

---

# 63. WEBHOOK FRAMEWORK

Do not implement every integration webhook differently.

Build a reusable webhook processing pattern:

incoming request

→ identify provider

→ verify signature

→ store raw event safely

→ idempotency check

→ parse event

→ normalize event

→ execute handler

→ record status

→ retry if required

This will be useful for:

* livestream
* payments
* communication providers
* future integrations.

---

# 64. PRODUCTION DATA INTEGRITY

Use database transactions for operations involving multiple dependent changes.

Avoid partial state such as:

event created but permissions missing

or:

payment recorded but giving transaction absent

or:

livestream started but internal session remains scheduled.

Where distributed systems prevent a single database transaction, implement reconciliation/idempotency.

---

# 65. SOFT DELETION / ARCHIVING

Not every record should be permanently deleted.

Important historical resources may need:

* archived_at
* deleted_at
* archived_by

Use permanent deletion only when appropriate.

---

# 66. INTERNATIONAL/FUTURE READINESS

Do not unnecessarily assume:

* one church expression
* one country
* one timezone
* one currency
* one livestream provider
* one payment provider
* one AI provider

The initial deployment may use a specific country/church structure, but architectural assumptions should not prevent expansion.

---

# 67. TIMEZONE HANDLING

Store timestamps consistently.

Present service/event times using appropriate church/expression timezone.

Do not rely on the developer's machine timezone.

---

# 68. ADMIN DASHBOARD

Dashboard data must come from real metrics.

Potential sections:

* members
* active expressions
* upcoming services
* events
* livestream status
* attendance
* recent announcements
* pending moderation/actions
* giving
* system health

Do not use hardcoded dashboard statistics.

---

# 69. LIVESTREAM ADMIN CONSOLE

Provide a proper livestream operational interface.

Potential capabilities:

* Create livestream
* Schedule
* Associate service/event
* Choose expression
* Select provider/configuration if authorised
* Generate ingest details
* Show stream key securely
* Copy server/RTMP/SRT details where applicable
* Show connection state
* Preview
* Go-live state
* End broadcast
* Recording status
* Publish replay
* Analytics
* Moderation controls
* Error diagnostics

Never expose a stream key publicly.

---

# 70. MEDIA TEAM WORKFLOW

Media staff may need limited livestream permissions without full platform administration.

Example capability:

`livestream.operate`

could allow them to:

* see encoder details
* start scheduled streams
* monitor status
* end broadcasts

without allowing them to:

* modify platform integrations
* change organisation roles
* access finance
* manage AI credentials.

---

# 71. AI ADMINISTRATION

AI settings should eventually support:

* provider
* models
* enabled capabilities
* budget/usage policies where needed
* prompt templates where appropriate
* usage logs
* errors
* moderation controls

Do not expose raw system prompts unnecessarily to ordinary users.

---

# 72. AI USAGE AUDITING

For administrative AI functionality, record where appropriate:

* user
* feature
* provider
* model
* timestamp
* token/usage information where available
* success/failure

Do not automatically store sensitive full prompts forever unless retention is intentionally designed.

---

# 73. PRIVACY

The system will handle personal and potentially pastoral information.

Design accordingly.

Differentiate:

* public profile information
* church-member information
* administrative information
* pastoral/confidential information

Do not allow ordinary church members to query the full member directory unless this is intentionally configured.

---

# 74. DATA EXPORT / ADMINISTRATION

Architecture should make it possible for authorised administrators to export appropriate information later.

Examples:

* attendance
* members
* event registrations
* giving reports

Exports must honour permissions.

---

# 75. RATE LIMITING / ABUSE

Protect public and sensitive operations.

Especially:

* login/reset
* prayer submission
* public forms
* livestream chat
* AI requests
* invitations
* verification requests

Do not rely solely on UI restrictions.

---

# 76. INVITATION SYSTEM

Leadership/member role invitations should use proper records.

Example states:

* pending
* accepted
* expired
* revoked

Do not grant privileges merely because somebody knows a URL.

Invitation acceptance must verify the intended identity according to the product design.

---

# 77. ACTIVITY HISTORY

Where operationally useful, show understandable activity such as:

* Event created
* Livestream scheduled
* Sermon published
* Leader assigned
* Member added

This can be powered from audit/domain events rather than building unrelated activity tables everywhere.

---

# 78. APPLICATION CONFIGURATION

Move settings that administrators reasonably need to control into the admin experience.

Do not require source code deployment for ordinary operational configuration.

However, do not expose dangerous infrastructure settings merely for the sake of configurability.

---

# 79. DO NOT HARD-CODE

Avoid hardcoding:

* church expressions
* leaders
* role definitions
* permissions
* event categories
* department names
* livestream provider
* AI provider
* notification provider
* payment provider
* important URLs
* feature availability
* livestream IDs
* pricing
* church contact details

Use database/provider configuration where appropriate.

---

# 80. DO NOT BUILD FAKE PRODUCTION FEATURES

Specifically avoid:

* mock livestream viewers
* fake online users
* fake attendance
* fake donation totals
* random dashboard numbers
* locally generated fake notifications
* hardcoded sermon arrays
* placeholder events pretending to be database events
* static users
* fake analytics
* fake AI responses
* fake stream status

If the backend does not yet exist, implement it.

---

# 81. CODE QUALITY

Use:

* TypeScript
* strict types where practical
* reusable domain types
* schema validation
* consistent error handling
* services/repositories where useful
* provider adapters
* shared utilities
* maintainable module boundaries

Do not create one enormous service or component containing the entire platform.

---

# 82. FRONTEND/BACKEND CONTRACTS

Use clear typed contracts.

Avoid components depending directly on database implementation details where a service layer provides a cleaner boundary.

Normalize provider-specific responses before they reach ordinary UI.

---

# 83. PRODUCTION DEPLOYMENT

The build must ultimately be deployable through the existing production infrastructure.

Use the project's existing:

* GitHub repository
* Supabase project
* hosting/deployment platform
* Expo infrastructure
* environment configuration

Do not create disconnected internal repositories or temporary replacement projects.

---

# 84. GITHUB WORKFLOW

Work against the actual project repository.

Use branches appropriately.

Commit meaningful production changes.

Do not commit:

* secrets
* `.env` credentials
* provider private keys
* generated junk
* unnecessary build artifacts

When a major implementation unit is production-ready, create a Pull Request against the actual live repository branch used by this project.

The Pull Request should explain:

* what changed
* migrations
* environment changes
* new integrations
* testing performed
* deployment requirements
* potential risks

---

# 85. SUPABASE

The connected Supabase project is part of the real application.

Use proper migrations and deployment procedures.

Before changing database structures:

Inspect current remote state and existing migration history.

After creating valid migrations:

apply them to the intended environment according to safe deployment practices.

Do not continuously create new tables because you failed to inspect the existing ones.

---

# 86. PRODUCTION GATES

Before considering a feature completed, verify:

### Backend

* schema exists
* permissions exist
* RLS exists
* API exists
* validation exists
* failures handled
* audit requirements handled
* integrations are real

### Frontend

* real backend connected
* permission-aware
* loading
* empty
* error
* success
* responsive
* accessible
* correct navigation

### Operations

* logs available
* configuration documented
* environment variables documented
* deployment path known

### Testing

* critical path tested
* authorization tested
* major failures tested

Only then treat the feature as completed.

---

# 87. CONTINUE FROM CURRENT BUILD

Do not interpret this document as an instruction to discard previous work.

The correct workflow is:

inspect existing implementation

→ classify existing modules

→ preserve good architecture

→ repair broken systems

→ complete unfinished production flows

→ replace prototype/mock systems

→ connect frontend and backend

→ apply security

→ deploy migrations

→ verify production behaviour

→ continue to next domain.

---

# 88. IMPLEMENTATION PRIORITY

Prioritize foundational production systems before cosmetic additions.

Recommended priority:

1. Audit existing implementation
2. Authentication integrity
3. Organisation/expression architecture
4. Role/permission system
5. Database/RLS integrity
6. Platform/admin foundation
7. Member/leadership foundation
8. Events/services
9. Notification infrastructure
10. Real third-party livestream integration
11. Livestream operational/admin UX
12. Member livestream UX
13. Sermons/media/replays
14. Groups/departments
15. Attendance
16. Prayer/pastoral systems
17. Giving/payment architecture
18. AI provider architecture and features
19. Analytics/reporting
20. remaining expansion modules

This order can be adjusted after inspecting what has already been completed.

Do not rebuild something already production-ready just because it appears earlier on this list.

---

# 89. THIRD-PARTY LIVESTREAMING — FINAL DIRECTIVE

The livestream architecture is especially important.

We are intentionally using a third-party service for the heavy video infrastructure.

Our application should NOT attempt to build its own video CDN/transcoding infrastructure from scratch.

The third party handles things such as:

* video ingest
* transcoding
* adaptive bitrate streaming
* global delivery
* playback infrastructure
* recordings where supported
* stream health
* analytics where supported

Our platform handles:

* church livestream creation
* scheduling
* permissions
* provider configuration
* encoder workflow
* service/event association
* stream state
* member playback experience
* moderation
* notifications
* metadata
* recordings/replays
* sermon conversion
* analytics presentation
* provider webhooks
* audit trail

Separate these responsibilities cleanly.

---

# 90. DO NOT HARD-CODE THE STREAMING PROVIDER

Even when the first provider has been selected, implement:

Provider interface

→ Provider adapter

→ Provider-specific API client

rather than:

UI → Vendor API everywhere.

If we later change provider, the church platform should not require a complete rewrite.

---

# 91. DOCUMENTATION

As implementation progresses, maintain useful technical documentation for:

* architecture
* database
* roles
* permissions
* environment variables
* integrations
* livestream configuration
* AI configuration
* deployment
* migration procedures
* webhook endpoints

Documentation should reflect actual implementation, not hypothetical systems.

---

# 92. DEFINITION OF DONE

A feature is NOT done because:

* a screen exists
* TypeScript compiles
* a button can be clicked
* mock data appears
* database table exists
* one happy path worked once

A production feature is done when its complete user and operational flow works safely with real backend data and appropriate permissions.

---

# 93. FINAL BUILD PHILOSOPHY

Think of this project as infrastructure the church will actually depend upon.

People will use it for:

* worship
* communication
* membership
* livestream services
* administration
* giving
* leadership
* pastoral operations

Build accordingly.

Do not optimise for the fastest way to show progress.

Optimise for the fastest responsible path toward a reliable production platform.

Continue from the existing codebase.

Do not restart unnecessarily.

Do not replace production work with prototypes.

Do not hardcode business/platform logic.

Do not simulate features that are supposed to be real.

Use real backend functionality.

Use third-party infrastructure for real livestream delivery.

Keep livestream providers abstracted.

Keep AI providers abstracted.

Keep integrations extensible.

Secure the database.

Use permissions correctly.

Connect all frontend flows to the real backend.

Build every module with deployment and production usage in mind.

The objective is not:

"make the application look complete."

The objective is:

**BUILD THE ACTUAL CHURCH DIGITAL PLATFORM FOR PRODUCTION.**
