-- Extend ministry AI artwork to Expression banners while keeping member/leader identity photos upload-only.
alter table public.cot_ministry_generated_media
  drop constraint if exists cot_ministry_generated_media_use_case_check;

alter table public.cot_ministry_generated_media
  add constraint cot_ministry_generated_media_use_case_check
  check (use_case in (
    'event_banner',
    'announcement_banner',
    'home_banner',
    'form_banner',
    'sermon_artwork',
    'library_cover',
    'expression_banner'
  ));
