-- The sermon content-block trigger runs in the caller's security context.
-- Its helper is intentionally private, so the trigger wrapper must execute as
-- its owner rather than requiring every insert/update caller to execute the
-- private parser directly.
create or replace function private.sync_sermon_content_blocks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  new.content_blocks := private.sermon_blocks_from_text(
    coalesce(nullif(btrim(new.transcript), ''), nullif(btrim(new.description), ''), '')
  );
  return new;
end;
$function$;

revoke all on function private.sync_sermon_content_blocks() from public, anon, authenticated;
