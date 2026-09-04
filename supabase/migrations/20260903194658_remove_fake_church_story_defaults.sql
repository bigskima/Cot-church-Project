-- Missing church history must remain missing; the product must never invent a founding year.
alter table public.church_story
  alter column founding_year drop default;

-- Remove the legacy seeded 2010 only from clearly untouched placeholder rows.
update public.church_story
set founding_year = null
where founding_year = 2010
  and coalesce(trim(mission), '') = ''
  and coalesce(trim(vision), '') = ''
  and coalesce(trim(founding_story), '') = ''
  and title = 'Our Story & Heritage'
  and created_at = updated_at;
