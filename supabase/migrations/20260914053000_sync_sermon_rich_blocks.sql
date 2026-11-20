-- Keep the structured sermon representation synchronized with the compatibility
-- transcript/description fields. Current clients can continue sending Markdown-like
-- transcript blocks while newer readers consume content_blocks directly.

create or replace function private.sermon_blocks_from_text(source_text text)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', 'block-' || part.ordinality::text,
        'type', case
          when left(btrim(part.value), 2) = '**' and right(btrim(part.value), 2) = '**'
            and char_length(btrim(part.value)) >= 4 then 'highlight'
          else 'paragraph'
        end,
        'text', case
          when left(btrim(part.value), 2) = '**' and right(btrim(part.value), 2) = '**'
            and char_length(btrim(part.value)) >= 4
            then btrim(substring(btrim(part.value) from 3 for char_length(btrim(part.value)) - 4))
          else btrim(part.value)
        end
      )
      order by part.ordinality
    ) filter (where nullif(btrim(part.value), '') is not null),
    '[]'::jsonb
  )
  from regexp_split_to_table(coalesce(source_text, ''), E'\\n[\\t ]*\\n+') with ordinality as part(value, ordinality);
$function$;

revoke all on function private.sermon_blocks_from_text(text) from public, anon, authenticated;

create or replace function private.sync_sermon_content_blocks()
returns trigger
language plpgsql
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

drop trigger if exists sync_sermon_content_blocks on public.sermons;
create trigger sync_sermon_content_blocks
before insert or update of transcript, description on public.sermons
for each row execute function private.sync_sermon_content_blocks();

-- Rebuild existing records from transcript first, falling back to the excerpt.
update public.sermons
set content_blocks = private.sermon_blocks_from_text(
  coalesce(nullif(btrim(transcript), ''), nullif(btrim(description), ''), '')
);
