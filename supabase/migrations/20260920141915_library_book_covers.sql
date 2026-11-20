alter table public.library_books
  add column if not exists cover_path text;

alter table public.library_books
  drop constraint if exists library_books_cover_path_check;

alter table public.library_books
  add constraint library_books_cover_path_check
  check (cover_path is null or char_length(cover_path) <= 600);
