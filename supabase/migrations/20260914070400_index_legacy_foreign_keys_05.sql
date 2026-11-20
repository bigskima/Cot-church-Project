-- Cover legacy public-schema foreign-key relationships flagged by Supabase's advisor.
-- These are plain btree indexes on the FK columns in constraint order; no data or
-- authorization semantics are changed.

create index if not exists cot_fk_cover_0201 on public.sermon_series (created_by);
create index if not exists cot_fk_cover_0202 on public.sermons (expression_id);
create index if not exists cot_fk_cover_0203 on public.sermons (recording_id);
create index if not exists cot_fk_cover_0204 on public.sermons (created_by);
create index if not exists cot_fk_cover_0205 on public.sermons (series_id, organization_id);
create index if not exists cot_fk_cover_0206 on public.sermons (content_item_id, organization_id);
create index if not exists cot_fk_cover_0207 on public.social_comments (organization_id);
create index if not exists cot_fk_cover_0208 on public.social_comments (post_id, organization_id);
create index if not exists cot_fk_cover_0209 on public.social_comments (parent_comment_id, organization_id);
create index if not exists cot_fk_cover_0210 on public.social_comments (author_membership_id, organization_id);
create index if not exists cot_fk_cover_0211 on public.social_media_uploads (uploader_profile_id);
create index if not exists cot_fk_cover_0212 on public.social_media_uploads (branch_id, organization_id);
create index if not exists cot_fk_cover_0213 on public.social_posts (author_membership_id, organization_id);
create index if not exists cot_fk_cover_0214 on public.social_posts (branch_id, organization_id);
create index if not exists cot_fk_cover_0215 on public.social_posts (group_id, organization_id);
create index if not exists cot_fk_cover_0216 on public.social_reactions (organization_id);
create index if not exists cot_fk_cover_0217 on public.social_reactions (post_id, organization_id);
create index if not exists cot_fk_cover_0218 on public.social_reactions (membership_id, organization_id);
create index if not exists cot_fk_cover_0219 on public.stream_messages (organization_id);
create index if not exists cot_fk_cover_0220 on public.stream_messages (hidden_by);
create index if not exists cot_fk_cover_0221 on public.stream_messages (stream_id, organization_id);
create index if not exists cot_fk_cover_0222 on public.stream_messages (membership_id, organization_id);
create index if not exists cot_fk_cover_0223 on public.stream_reactions (organization_id);
create index if not exists cot_fk_cover_0224 on public.stream_reactions (profile_id);
create index if not exists cot_fk_cover_0225 on public.stream_reactions (stream_id, organization_id);
create index if not exists cot_fk_cover_0226 on public.stream_viewer_sessions (organization_id);
create index if not exists cot_fk_cover_0227 on public.stream_viewer_sessions (profile_id);
create index if not exists cot_fk_cover_0228 on public.stream_viewer_sessions (stream_id, organization_id);
create index if not exists cot_fk_cover_0229 on public.streaming_provider_configs (provider_id);
create index if not exists cot_fk_cover_0230 on public.videos (id, organization_id);
create index if not exists cot_fk_cover_0231 on public.videos (media_asset_id, organization_id);
create index if not exists cot_fk_cover_0232 on public.videos (series_id, organization_id);
create index if not exists cot_fk_cover_0233 on public.volunteer_applications (organization_id);
create index if not exists cot_fk_cover_0234 on public.volunteer_applications (reviewed_by);
create index if not exists cot_fk_cover_0235 on public.volunteer_applications (opportunity_id, organization_id);
create index if not exists cot_fk_cover_0236 on public.volunteer_applications (membership_id, organization_id);
create index if not exists cot_fk_cover_0237 on public.volunteer_opportunities (created_by);
create index if not exists cot_fk_cover_0238 on public.volunteer_opportunities (branch_id, organization_id);
create index if not exists cot_fk_cover_0239 on public.volunteer_opportunities (ministry_id, organization_id);
create index if not exists cot_fk_cover_0240 on public.volunteer_schedules (organization_id);
create index if not exists cot_fk_cover_0241 on public.volunteer_schedules (opportunity_id, organization_id);
create index if not exists cot_fk_cover_0242 on public.volunteer_schedules (membership_id, organization_id);
create index if not exists cot_fk_cover_0243 on public.workflow_runs (organization_id);
create index if not exists cot_fk_cover_0244 on public.workflow_runs (domain_event_id);
create index if not exists cot_fk_cover_0245 on public.workflow_runs (workflow_definition_id, organization_id);
