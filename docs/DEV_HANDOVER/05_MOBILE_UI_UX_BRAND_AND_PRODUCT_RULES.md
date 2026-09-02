# 05 — Mobile UI/UX, Brand and Product Rules

## Latest brand decision

The old Brown/Gold "luxury" mobile design is obsolete and must not return.

The accepted primary mobile visual direction is:

- dark navy / dark blue
- white
- restrained interactive blue
- semantic red/green/amber/violet only where meaning requires it

The app supports Light, Dark and System theme preferences.

## Desired product feeling

The application should feel:

- modern
- calm
- trustworthy
- premium
- content-first
- media-aware
- human
- international
- mature
- accessible

It should not feel like:

- an AI-generated dashboard template
- a casino/crypto interface
- a brown/gold church flyer
- a collection of rounded cards
- a generic admin panel disguised as a member app

## Brand token direction

Use semantic design tokens rather than raw color values scattered throughout screens.

A reasonable navy/blue family includes values in the general range already being used in the current design system. The exact tokens may evolve, but the identity should remain navy/white with restrained blue accents.

Light mode should use white/very light neutral backgrounds, dark navy text and subtle borders.

Dark mode should use dark navy—not brown—and readable light text.

Pure black may be used where media playback genuinely benefits from it.

## Semantic colors

Use color meaningfully:

- red: real LIVE/destructive state
- green: success
- amber: warning
- blue: information/interaction
- restrained violet: prayer/pastoral only where useful

Do not use semantic colors merely as decoration.

## Theme architecture

Preserve the existing ThemeProvider/system-light-dark preference architecture.

Screens should consume semantic theme tokens for:

- background
- surfaces
- text
- borders
- interactive state
- inputs
- semantic statuses

Avoid raw hardcoded hex values inside feature screens except where genuinely media/semantic specific.

## Typography

Use one coherent modern sans-serif family/approach.

Prefer a hierarchy based on semibold/bold rather than making nearly every label `fontWeight: 900`.

Typical hierarchy:

- display/H1 for major page title
- H2/H3 for section hierarchy
- 15–16px body
- 13–14px secondary body
- 11–12px caption
- 14–16px button labels

The interface should read clearly rather than shout.

## Copy style

Use natural product language.

Avoid overly theatrical/repetitive terms like "Sanctuary" on every label simply because the product is for churches.

Examples:

- `Profile`, not `Sanctuary Profile`
- `Sign out`, not `Sign Out of Sanctuary`
- `Upcoming live services`, not a decorative invented title

Use actual organisation/expression names for church identity.

## Icon system

Do not use emoji as primary UI icons.

Use one consistent vector icon family through the shared `Icon` primitive.

Emoji may appear as actual reaction/content if intentionally supported, but not as the foundation of navigation, buttons, empty states and menus.

## Bottom navigation

Keep the visible member bottom navigation to at most five core tabs.

Current approved direction:

- Home
- Discover
- Reels
- Community
- Profile

Live remains contextually accessible.

Use safe-area-aware sizing, readable labels and vector icons. No tiny glyphs, diamonds or six-tab crowding.

## Headers

Create/reuse a coherent header system for:

- root tabs
- detail pages
- media pages
- modals/full-screen flows
- leadership tools

Do not reinvent padding, back buttons and title alignment in every screen.

## Safe areas

Use `react-native-safe-area-context` correctly.

Do not use arbitrary fixed top padding everywhere as a substitute for actual device insets.

## Home design rules

Home should be consumer/media-focused.

A good hierarchy can include:

1. organisation/expression context + utility actions
2. real live/next stream state if available
3. featured/continue media
4. sermons/Watch
5. Reels
6. events
7. community highlights

Do not build a dashboard grid of equal-weight cards.

Do not fabricate empty sections to make Home look busy.

## Cards and surfaces

Reduce card overuse.

Not every item needs a bordered rounded rectangle.

Use a mix of:

- borderless list rows
- media tiles
- horizontal shelves
- grouped sections
- subtle surfaces

Avoid card-inside-card layouts.

Use restrained corner radii and minimal shadows.

## Shadows and gradients

Shadows should be subtle.

Dark mode should rely more on surface contrast/borders than glow.

Avoid gold glows and decorative pulsing.

Use gradients mainly where they improve text legibility over media.

## Splash and bootstrap

Keep two concepts separate:

### Native splash

Bundled, instant, offline-safe. Dark navy background with approved logo. Do not rely on network branding before native startup.

### Runtime/dynamic brand launch

After React starts, runtime branding may use fetched launch logo/background if needed. Do not artificially hold this screen for several seconds.

Bootstrap should restore theme/session/branding/context without flashing the wrong theme, fake church or login unnecessarily.

## Branding data

Use the existing platform branding service/backend for runtime-controlled brand assets where supported.

Do not hardcode fake church branding as fallback business data.

## Discover/search UI

Discover should have a clean search/filter experience and may surface sermons, Watch, Reels, events, expressions, leaders and series.

As the dataset grows, perform server-side query/search rather than only filtering a tiny downloaded list.

## Church story/heritage

Never invent:

- mission
- vision
- founding year
- founding story
- milestones
- leader profiles

If no church-story configuration exists, display an honest unpublished/unconfigured state.

## Live UI

Use media-first presentation.

A live card/player must show real:

- stream title
- owning expression/organisation
- real status
- real schedule
- real thumbnail/poster if available

If no stream is scheduled, say so. Do not invent a Sunday schedule.

Red is reserved for genuine LIVE state.

## Reels UI

Full-screen vertical video should prioritize the media.

Support real creator attribution and action rail. Avoid heavy surrounding chrome.

Handle player lifecycle, backgrounding and network errors correctly.

## Watch UI

Long-form video should use a wider media-first hierarchy with title, metadata, description, chapters, progress, related content and engagement.

## Sermon UI

Adapt to real audio/video availability. Do not invent preacher names, transcript or media URLs.

For missing optional metadata, omit it or use a neutral unavailable state.

## Audio player

Use a polished audio experience with play/pause, seek, duration, ±15 seconds, speed, background audio where supported and persistent progress where appropriate.

## Community UI

Community should visually behave like a modern social feed with whitespace and hierarchy rather than a grid of dashboard cards.

Comments/replies should expose loading, pagination, submission failure and retry rather than swallowing errors silently.

## Events UI

Event cards/detail pages must use real date/time/timezone/location/registration state.

Do not default missing venue data to `Main Sanctuary` or similar fake values.

## Prayer/pastoral UI

Use calm, clear privacy-forward design.

Clearly communicate visibility such as pastoral-only or prayer-team access.

Do not expose sensitive content in previews to unauthorized roles.

## Giving UI

Giving should feel trustworthy and financial.

Prioritize amount, currency, campaign/category, payment state, receipt and history rather than decorative graphics.

Only show success after backend verification.

## Profile UI

Use real avatar/name/expression/membership information.

Group settings and services logically.

Remove fake QR/member-pass simulations unless backed by a real secure credential implementation.

Every visible profile row must route somewhere real or be hidden.

## Leadership Hub UI

Leadership Hub is a clean role-aware launcher, not a second Platform Admin.

Show only authorized modules based on actual capabilities and current tenant scope.

## Creator Studio UI

Do not use four decorative emoji cards as the final production studio.

Provide professional publishing tools and real states for drafts, upload progress, processing, publication and failures.

If file/media upload is exposed, it must actually select/upload/process files.

## AI Assistant UI

Route AI actions to the real assistant.

Use a modern conversation layout with input, send, loading/streaming, retry and failure states.

Do not fabricate assistant responses client-side.

## Loading states

Use skeletons that resemble final content when appropriate.

Avoid indefinite generic spinners.

## Empty states

Empty states must tell the truth.

Example:

`No upcoming live services have been scheduled.`

Do not fill an empty state with invented church-specific schedule or history.

## Error states

Handle:

- offline
- timeout
- 401
- 403
- 404
- server error
- provider error

Users should receive clear feedback and retry where appropriate.

Important actions must not use silent `catch {}` patterns that hide failure.

## Static-data rule

Static content is acceptable for generic labels/help text.

Never hardcode/fabricate business data such as:

- church name
- expression name
- leader name
- role
- schedule
- event
- sermon
- preacher
- mission/vision/history
- member pass/QR
- viewer count
- giving figures
- live status
- provider state
- analytics

If backend data is absent, omit it or show an honest empty state.

## Responsive targets

Test native and web at minimum across:

- small Android phone
- normal Android phone
- iPhone sizes where available
- tablet
- web 320 / 360 / 390 / 430 widths
- tablet web
- desktop web

No clipping, overflow, hidden CTA, tab crowding or safe-area collisions.

## Web presentation

Expo Web should not simply stretch a phone column indefinitely.

Constrain content widths appropriately. Long-form Watch can use wider media layouts; Reels should remain portrait-constrained. Desktop navigation can adapt responsively without changing route semantics.

## Accessibility

Support:

- adequate touch targets
- screen-reader labels
- semantic buttons/inputs
- readable contrast
- keyboard navigation/focus on web
- text scaling tolerance
- non-color-only status cues

## Performance

Audit:

- unnecessary API waterfalls
- repeated requests
- unpaginated feeds
- oversized images
- too many prepared video players
- unnecessary realtime subscriptions
- rerenders

Use pagination/caching/preloading responsibly.

## UI definition of done

A screen is not done because it looks attractive.

It is done only when:

- current brand system is used
- light/dark mode work
- real data is wired
- permission/scope are correct
- loading/empty/error are present
- routes/actions work
- no fabricated business data remains
- accessibility/responsiveness are tested
- production build/typecheck passes