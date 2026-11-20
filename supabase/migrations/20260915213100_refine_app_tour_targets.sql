-- Keep every seeded tour step attached to a real, stable screen target.
-- Expression quick links are intentionally omitted from the first tour version
-- because their vertical position changes with live/participation content.

delete from public.app_tour_steps s
using public.app_tour_experiences e
where s.experience_id = e.id
  and e.scope = 'expression'
  and e.version = 'expression-tour-2026-09-v2'
  and s.target_key = 'expression.home.quick-links';

update public.app_tour_steps s
set
  title = 'Expression updates stay in this space',
  body = 'This notification entry only contains updates from the Expression you opened. The Expression name remains visible in the workspace header above so you always know which private space you are using.',
  icon = 'notifications-outline',
  placement = 'below'
from public.app_tour_experiences e
where s.experience_id = e.id
  and e.scope = 'expression'
  and e.version = 'expression-tour-2026-09-v2'
  and s.target_key = 'expression.header';

update public.app_tour_steps s
set
  title = 'This home belongs to this Expression',
  body = 'Everything in this home is scoped to this Expression. The guide can move you to other real screens without mixing private Expression content with General COT.',
  placement = 'center'
from public.app_tour_experiences e
where s.experience_id = e.id
  and e.scope = 'expression'
  and e.version = 'expression-tour-2026-09-v2'
  and s.target_key = 'expression.home.hero';
