# COT content repair verification

The Home/chat safety table, group creator enrollment, joining policies, request review, and sermon identity repairs are applied to COT. The two new migrations were checked in a rolled-back fixture transaction before application and the same checks passed afterward. Existing Young leaders creator access is active/leader. Sermon identities preserve original visibility, including the members-only Abuja sermon.

The updated home-feed, chat, groups, sermons, public-content, content-media, engagement, and safety-controls Edge Functions are deployed. Existing JWT gateway settings were retained. Public Home, Reels, sermons, events and Expression discovery returned HTTP 200 after deployment; Home reported no degraded sections. Reel counters now use canonical engagement records.

Four resource tests cover preserving mounted content, rejecting stale responses, clearing private caches on scope/account changes, retaining content after transient errors, and separating playback from engagement invalidation. Mobile/admin typechecks, the web export, repository invariants, and Deno checks passed. GitHub application CI and both Vercel previews passed. Supabase advisor counts are unchanged.

Twelve older migration filenames were aligned with the versions already recorded in COT so automatic deployments do not replay applied SQL. Their SQL was preserved. Eleven matched deployed SQL after ignoring comments/whitespace; the remaining public-posting policy differences are already applied by its subsequent hardening migration, verified directly in the database. No database migration-history rows were edited.

To repeat the database regression exercise, run scripts/verify-cot-content.sql against the migrated database; all fixtures are rolled back. Run npm run mobile:test:resources for the UI resource behavior tests.

Browser verification of the preview was blocked by Vercel authentication. Signed-in interaction flows still require an authenticated browser session for a full end-to-end check. Public API and database/RLS checks do not claim to replace that verification.
