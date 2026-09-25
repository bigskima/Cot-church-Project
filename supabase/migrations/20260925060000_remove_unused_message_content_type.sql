do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid=e.enumtypid
    where t.typname='content_item_type' and e.enumlabel='message'
  ) then
    alter type public.content_item_type rename to content_item_type_legacy;
    create type public.content_item_type as enum ('post','reel','video','sermon','live_stream');
    alter table public.content_items
      alter column content_type type public.content_item_type
      using content_type::text::public.content_item_type;
    drop type public.content_item_type_legacy;
  end if;
end $$;
