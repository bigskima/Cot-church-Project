export type LibraryBook = {
  id: string;
  organization_id: string;
  title: string;
  subtitle?: string;
  author_name: string;
  publisher?: string;
  isbn?: string | null;
  description?: string;
  source_format: 'epub' | 'pdf';
  source_path?: string;
  source_url?: string | null;
  cover_path?: string | null;
  cover_url?: string | null;
  rights_basis?: string;
  redistribution_confirmed?: boolean;
  status: 'draft' | 'processing' | 'published' | 'failed' | 'archived';
  published_at?: string | null;
  review_average?: number | null;
  review_count?: number;
  progress?: ReadingProgress | null;
};
export type BookChapter = { id: string; book_id: string; chapter_order: number; title: string; body: string; source_href?: string | null };
export type BookReview = {
  id: string; book_id: string; profile_id: string; rating: number; body: string; created_at: string;
  profile?: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
};
export type ReadingProgress = { book_id: string; profile_id: string; chapter_order: number; page_index: number; progress_percent: number; updated_at: string };
export type BookDetailPayload = { book: LibraryBook; chapters: BookChapter[]; reviews: BookReview[]; progress?: ReadingProgress | null };
export type DevotionalSeries = {
  id: string; organization_id: string; book_id?: string | null; title: string; author_name?: string; devotional_year: number;
  description?: string; status: 'draft' | 'published' | 'archived'; published_at?: string | null;
};
export type DevotionalEntry = {
  id: string; series_id: string; chapter_id?: string | null; devotional_date: string; title: string; scripture: string;
  memory_verse: string; body: string; prayer: string;
};
export type DailyDevotionalPayload = { series: DevotionalSeries; entry: DevotionalEntry };
