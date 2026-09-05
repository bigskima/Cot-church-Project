-- Ensure new Supabase Auth users are provisioned through the canonical profile
-- trigger that copies username/display name/birthday/profile metadata.

drop trigger if exists auth_user_created on auth.users;

create trigger auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;

drop function if exists public.create_profile_for_new_user();
