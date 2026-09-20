begin;

alter table public.church_story
  add column if not exists quick_facts jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'church_story_quick_facts_array_check'
      and conrelid = 'public.church_story'::regclass
  ) then
    alter table public.church_story
      add constraint church_story_quick_facts_array_check
      check (jsonb_typeof(quick_facts) = 'array');
  end if;
end
$$;

commit;
