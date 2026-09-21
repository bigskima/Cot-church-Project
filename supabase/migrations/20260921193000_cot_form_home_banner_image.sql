-- Give configurable forms a first-class visual for Home spotlight discovery.
alter table public.cot_forms
  add column if not exists banner_image_url text;

comment on column public.cot_forms.banner_image_url is
  'Optional 16:7 image used when a published form is automatically surfaced in the General COT Home spotlight.';
