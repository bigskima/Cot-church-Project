insert into public.app_tour_steps (
  experience_id,
  step_order,
  target_key,
  route_template,
  title,
  body,
  icon,
  placement
)
select
  e.id,
  6,
  'general.tour.restart',
  '/general/tour',
  'Restart any tour from your account',
  'COT can scroll directly to the relevant help area when a tour step is lower on a page. Use this account screen whenever you want to replay General COT or any Expression tour, even after choosing “Never remind me”.',
  'navigate-circle-outline',
  'above'
from public.app_tour_experiences e
where e.scope = 'general'
  and e.version = 'general-cot-tour-2026-09-v2'
on conflict (experience_id, step_order) do update set
  target_key = excluded.target_key,
  route_template = excluded.route_template,
  title = excluded.title,
  body = excluded.body,
  icon = excluded.icon,
  placement = excluded.placement;
