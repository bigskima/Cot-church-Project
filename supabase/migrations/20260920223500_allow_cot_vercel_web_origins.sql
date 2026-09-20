begin;

insert into public.platform_web_origins (origin_pattern, label, is_active)
values
  ('https://cot-app-green.vercel.app', 'COT app production on Vercel', true),
  ('https://cot-app-*.vercel.app', 'COT app Vercel aliases and previews', true),
  ('https://cot-*.vercel.app', 'COT app Vercel deployment previews', true),
  ('https://cot-admin.vercel.app', 'COT platform admin production on Vercel', true),
  ('https://cot-admin-*.vercel.app', 'COT platform admin Vercel previews', true)
on conflict (origin_pattern) do update
set is_active = true,
    label = excluded.label,
    updated_at = now();

commit;
