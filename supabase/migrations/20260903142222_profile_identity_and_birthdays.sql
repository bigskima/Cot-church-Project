-- Production profile expansion. Birthday remains private profile data; Expression birthday
-- features may surface it only for active members of that Expression under dedicated policies.

alter table public.profiles
  add column if not exists username text,
  add column if not exists birthday date,
  add column if not exists bio text;

update public.profiles
set username = lower(regexp_replace(split_part(coalesce(nullif(display_name,''), id::text), ' ', 1), '[^a-zA-Z0-9._]', '', 'g')) || '_' || left(replace(id::text,'-',''),6)
where username is null;

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  add constraint profiles_username_format_check check (username ~ '^[a-z0-9][a-z0-9._]{2,29}$'),
  add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 500),
  add constraint profiles_birthday_range_check check (birthday is null or birthday >= date '1900-01-01');

create unique index profiles_username_unique_ci on public.profiles(lower(username));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text;
begin
  candidate_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username','')));
  if candidate_username !~ '^[a-z0-9][a-z0-9._]{2,29}$'
     or exists(select 1 from public.profiles p where lower(p.username)=candidate_username) then
    candidate_username := lower(regexp_replace(split_part(coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''),new.email,new.phone,new.id::text),' ',1),'[^a-zA-Z0-9._]','','g'));
    candidate_username := left(coalesce(nullif(candidate_username,''),'member'),22) || '_' || left(replace(new.id::text,'-',''),6);
  end if;

  insert into public.profiles(id,display_name,phone_number,avatar_url,username,birthday,bio)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'),''),split_part(coalesce(new.email,new.phone,'Member'),'@',1)),
    coalesce(new.phone,nullif(trim(new.raw_user_meta_data ->> 'profile_phone'),'')),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'),''),
    candidate_username,
    case when coalesce(new.raw_user_meta_data ->> 'birthday','') ~ '^\d{4}-\d{2}-\d{2}$' then (new.raw_user_meta_data ->> 'birthday')::date else null end,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'bio','')),500),'')
  )
  on conflict(id) do nothing;
  return new;
end;
$$;

comment on column public.profiles.username is 'Public username/handle. Identity display only; never grants authorization.';
comment on column public.profiles.birthday is 'Private birthday used by member-authorized Expression birthday features; not public by default.';
comment on column public.profiles.bio is 'Optional public profile biography.';
