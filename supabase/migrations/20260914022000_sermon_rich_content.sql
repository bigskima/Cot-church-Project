-- Structured sermon reading content.
-- Existing description remains the plain-text compatibility/excerpt field.
-- content_blocks powers rich emphasis and progressive reading without breaking old sermons.

alter table public.sermons
  add column if not exists content_blocks jsonb not null default '[]'::jsonb;

alter table public.sermons
  drop constraint if exists sermons_content_blocks_array;

alter table public.sermons
  add constraint sermons_content_blocks_array
  check (jsonb_typeof(content_blocks) = 'array');

comment on column public.sermons.content_blocks is
  'Ordered sermon reading blocks. Supported app block kinds are paragraph and highlight; description remains the compatibility excerpt.';

update public.sermons s
set content_blocks = jsonb_build_array(
  jsonb_build_object('type', 'paragraph', 'text', s.description)
)
where s.content_blocks = '[]'::jsonb
  and nullif(btrim(s.description), '') is not null;
