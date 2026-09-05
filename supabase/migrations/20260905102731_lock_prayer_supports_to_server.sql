drop policy if exists prayer_supports_no_client_access on public.prayer_supports;

create policy prayer_supports_no_client_access
  on public.prayer_supports
  for all
  to anon, authenticated
  using (false)
  with check (false);
