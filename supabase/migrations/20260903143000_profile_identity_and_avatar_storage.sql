-- Production profile identity expansion and profile-avatar storage.
-- Existing members remain valid; new signup/API paths can require richer fields.

alter table public.profiles
  add column if not exists username text,
  add column if not exists full_name text,
  add column if not exists birth_date date,
  add column if not exists bio text;

update public.profiles
set full_name = display_name
where full_name is null or btrim(full_name) = '';

alter table public.profiles
  alter column full_name set not null;

alter table public.profiles
  add constraint profiles_username_format_check
    check (username is null or username ~ '^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$'),
  add constraint profiles_full_name_length_check
    check (char_length(btrim(full_name)) between 1 and 120),
  add constraint profiles_birth_date_check
    check (birth_date is null or (birth_date <= current_date and birth_date >= date '1900-01-01')),
  add constraint profiles_bio_length_check
    check (bio is null or char_length(bio) <= 500);

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_birth_date_month_day_idx
  on public.profiles (extract(month from birth_date), extract(day from birth_date))
  where birth_date is not null;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_username text;
  v_birth_date date;
  v_bio text;
begin
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, new.phone, 'Member'), '@', 1)
  );
  v_username := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');
  begin
    v_birth_date := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
  exception when others then
    v_birth_date := null;
  end;
  v_bio := nullif(btrim(new.raw_user_meta_data ->> 'bio'), '');

  insert into public.profiles (
    id,
    display_name,
    full_name,
    username,
    birth_date,
    bio,
    phone_number
  )
  values (
    new.id,
    v_full_name,
    v_full_name,
    v_username,
    v_birth_date,
    v_bio,
    new.phone
  );
  return new;
end;
$$;

-- Avatars are intentionally public profile images, but object writes remain server-controlled.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated direct-write policy is created for this bucket.
-- The profile-avatar Edge Function uses the service role after authenticating the caller.
