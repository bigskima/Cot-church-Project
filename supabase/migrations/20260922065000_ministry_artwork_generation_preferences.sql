-- Persist the guided ministry artwork controls without rewriting the existing generation history.
alter table public.cot_ministry_generated_media
  add column if not exists style text not null default 'auto',
  add column if not exists mood text not null default 'auto',
  add column if not exists advanced_direction text not null default '';

alter table public.cot_ministry_generated_media
  drop constraint if exists cot_ministry_generated_media_style_check,
  drop constraint if exists cot_ministry_generated_media_mood_check,
  drop constraint if exists cot_ministry_generated_media_advanced_direction_check;

alter table public.cot_ministry_generated_media
  add constraint cot_ministry_generated_media_style_check
    check (style in ('auto','photographic','illustrated','minimal','cinematic')),
  add constraint cot_ministry_generated_media_mood_check
    check (mood in ('auto','warm','reflective','energetic','elegant')),
  add constraint cot_ministry_generated_media_advanced_direction_check
    check (char_length(advanced_direction) <= 1200);

comment on column public.cot_ministry_generated_media.style is
  'Ministry-selected visual style used by the content-aware artwork generator.';
comment on column public.cot_ministry_generated_media.mood is
  'Ministry-selected visual mood used by the content-aware artwork generator.';
comment on column public.cot_ministry_generated_media.advanced_direction is
  'Optional human direction added after COT builds the prompt from the content itself.';
