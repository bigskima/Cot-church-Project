import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { parseEpub, devotionalDateFromChapter, parseDevotionalChapter } from "../_shared/library-epub.ts";
import { resolveActiveOrganizationId } from "../_shared/public-organization.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertObject, requiredString, uuid } from "../_shared/validation.ts";

const BOOK_BUCKET = "library-books";
const COVER_BUCKET = "library-covers";
const MAX_BOOK_BYTES = 75 * 1024 * 1024;
const FORMATS: Record<string, { format: "epub" | "pdf"; ext: string }> = {
  "application/epub+zip": { format: "epub", ext: "epub" },
  "application/pdf": { format: "pdf", ext: "pdf" },
};
const COVER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function optionalText(value: unknown, field: string, max: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.trim().length > max) throw new ApiError("VALIDATION_FAILED", `Invalid ${field}.`, 422);
  return value.trim();
}
function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return uuid(String(value), field, true)!;
}
function integer(value: unknown, field: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new ApiError("VALIDATION_FAILED", `Invalid ${field}.`, 422);
  return parsed;
}
function booleanValue(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new ApiError("VALIDATION_FAILED", `${field} must be true or false.`, 422);
  return value;
}
function safeFileName(value: unknown) {
  return optionalText(value, "fileName", 255).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "book";
}
function isoDate(value: unknown, field = "date") {
  const raw = requiredString(value, field, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}.`, 422);
  }
  return raw;
}

async function canManage(auth: any, organizationId: string) {
  if (!auth?.user) return false;
  for (const permission of ["sermons.manage", "sermons.create", "sermons.publish"]) {
    const { data } = await auth.client.rpc("has_permission", {
      target_organization_id: organizationId,
      requested_permission: permission,
      target_branch_id: null,
    });
    if (data === true) return true;
  }
  return false;
}

async function canPublish(auth: any, organizationId: string) {
  if (!auth?.user) return false;
  const { data } = await auth.client.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_permission: "sermons.publish",
    target_branch_id: null,
  });
  return data === true;
}

async function requireManage(auth: any, organizationId: string) {
  if (!(await canManage(auth, organizationId))) {
    throw new ApiError("LIBRARY_PERMISSION_DENIED", "Your ministry role cannot manage books.", 403);
  }
}
async function requirePublish(auth: any, organizationId: string) {
  if (!(await canPublish(auth, organizationId))) {
    throw new ApiError("LIBRARY_PUBLISH_DENIED", "Publishing books is not available to this account.", 403);
  }
}

async function bookCoverUrl(admin: any, path?: string | null) {
  if (!path) return null;
  return admin.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl ?? null;
}

async function hydrateBooks(admin: any, rows: any[], viewerId?: string | null) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [{ data: reviews }, { data: progress }] = await Promise.all([
    admin.from("library_reviews").select("book_id,rating").in("book_id", ids),
    viewerId
      ? admin.from("library_reading_progress").select("book_id,chapter_order,page_index,progress_percent,updated_at").eq("profile_id", viewerId).in("book_id", ids)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const reviewMap = new Map<string, { total: number; count: number }>();
  for (const review of reviews ?? []) {
    const current = reviewMap.get(review.book_id) ?? { total: 0, count: 0 };
    current.total += Number(review.rating);
    current.count += 1;
    reviewMap.set(review.book_id, current);
  }
  const progressMap = new Map((progress ?? []).map((row: any) => [row.book_id, row]));
  return Promise.all(rows.map(async (row) => {
    const score = reviewMap.get(row.id);
    return {
      ...row,
      cover_url: await bookCoverUrl(admin, row.cover_path),
      review_average: score?.count ? Math.round((score.total / score.count) * 10) / 10 : null,
      review_count: score?.count ?? 0,
      progress: progressMap.get(row.id) ?? null,
    };
  }));
}

async function requireBook(admin: any, bookId: string, organizationId: string) {
  const { data, error } = await admin.from("library_books").select("*").eq("id", bookId).eq("organization_id", organizationId).maybeSingle();
  if (error || !data) throw new ApiError("BOOK_NOT_FOUND", "This book is unavailable.", 404);
  return data;
}

async function sourceSignedUrl(admin: any, path: string) {
  const { data, error } = await admin.storage.from(BOOK_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) throw new ApiError("BOOK_OPEN_FAILED", "Unable to open this book file.", 500, undefined, false);
  return data.signedUrl;
}

export const libraryHandler = createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const admin = adminClient();
    const url = new URL(request.url);
    const requestedOrg = auth?.organizationId ?? optionalUuid(url.searchParams.get("organizationId"), "organizationId");
    const organizationId = await resolveActiveOrganizationId(admin, requestedOrg);
    const viewerId = auth?.user?.id ?? null;

    if (request.method === "GET") {
      const view = url.searchParams.get("view") ?? "list";

      if (view === "list") {
        const search = (url.searchParams.get("search") ?? "").trim().slice(0, 80);
        let query = admin.from("library_books")
          .select("id,organization_id,title,subtitle,author_name,publisher,isbn,description,source_format,cover_path,status,published_at,created_at")
          .eq("organization_id", organizationId)
          .eq("status", "published")
          .order("published_at", { ascending: false });
        if (search) query = query.or(`title.ilike.%${search.replace(/[,%()]/g, "")}%,author_name.ilike.%${search.replace(/[,%()]/g, "")}%`);
        const { data, error } = await query.limit(100);
        if (error) throw new ApiError("LIBRARY_LOAD_FAILED", "Unable to load the Library.", 500, undefined, false);
        return { data: await hydrateBooks(admin, data ?? [], viewerId) };
      }

      if (view === "detail") {
        const bookId = uuid(url.searchParams.get("bookId"), "bookId", true)!;
        const book = await requireBook(admin, bookId, organizationId);
        if (book.status !== "published" && !(await canManage(auth, organizationId))) {
          throw new ApiError("BOOK_NOT_FOUND", "This book is unavailable.", 404);
        }
        const [{ data: chapters, error: chapterError }, { data: reviews, error: reviewError }, { data: progress }] = await Promise.all([
          admin.from("library_book_chapters").select("id,book_id,chapter_order,title,body,source_href").eq("book_id", bookId).order("chapter_order"),
          admin.from("library_reviews").select("id,book_id,profile_id,rating,body,created_at,updated_at").eq("book_id", bookId).order("created_at", { ascending: false }).limit(100),
          viewerId ? admin.from("library_reading_progress").select("*").eq("book_id", bookId).eq("profile_id", viewerId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (chapterError || reviewError) throw new ApiError("BOOK_LOAD_FAILED", "Unable to prepare this book.", 500, undefined, false);
        const reviewerIds = [...new Set((reviews ?? []).map((review: any) => review.profile_id))];
        const { data: profiles } = reviewerIds.length
          ? await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", reviewerIds)
          : { data: [] as any[] };
        const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
        return {
          data: {
            book: { ...book, cover_url: await bookCoverUrl(admin, book.cover_path), source_url: book.source_format === "pdf" ? await sourceSignedUrl(admin, book.source_path) : null },
            chapters: chapters ?? [],
            reviews: (reviews ?? []).map((review: any) => ({ ...review, profile: profileMap.get(review.profile_id) ?? null })),
            progress: progress ?? null,
          },
        };
      }

      if (view === "manage") {
        await requireManage(auth, organizationId);
        const { data, error } = await admin.from("library_books").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
        if (error) throw new ApiError("LIBRARY_LOAD_FAILED", "Unable to load Library management.", 500, undefined, false);
        return { data: await hydrateBooks(admin, data ?? [], viewerId) };
      }

      if (view === "devotional") {
        const date = isoDate(url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10));
        const year = Number(date.slice(0, 4));
        const { data: seriesRows, error: seriesError } = await admin.from("devotional_series")
          .select("id,title,author_name,devotional_year,description,book_id")
          .eq("organization_id", organizationId)
          .eq("devotional_year", year)
          .eq("status", "published")
          .order("published_at", { ascending: false });
        if (seriesError) throw new ApiError("DEVOTIONAL_LOAD_FAILED", "Unable to load the devotional.", 500, undefined, false);
        const seriesIds = (seriesRows ?? []).map((row: any) => row.id);
        const { data: entries, error: entryError } = seriesIds.length
          ? await admin.from("devotional_entries").select("*").in("series_id", seriesIds).eq("devotional_date", date).limit(1)
          : { data: [], error: null };
        if (entryError) throw new ApiError("DEVOTIONAL_LOAD_FAILED", "Unable to load the devotional.", 500, undefined, false);
        const entry = entries?.[0] ?? null;
        const series = entry ? (seriesRows ?? []).find((row: any) => row.id === entry.series_id) ?? null : null;
        if (entry && series) return { data: { series, entry } };

        // Keep the original one-day devotional domain readable while churches
        // migrate into yearly/monthly devotional books.
        const { data: legacy, error: legacyError } = await admin.from("devotionals")
          .select("id,title,scripture,content,publish_date,created_by,created_at")
          .eq("organization_id", organizationId)
          .eq("status", "published")
          .eq("publish_date", date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (legacyError) throw new ApiError("DEVOTIONAL_LOAD_FAILED", "Unable to load the devotional.", 500, undefined, false);
        if (!legacy) return { data: null };
        return {
          data: {
            series: {
              id: `legacy-${legacy.id}`,
              organization_id: organizationId,
              book_id: null,
              title: "Daily Devotional",
              author_name: "",
              devotional_year: year,
              description: "",
              status: "published",
              published_at: legacy.created_at,
            },
            entry: {
              id: legacy.id,
              series_id: `legacy-${legacy.id}`,
              chapter_id: null,
              devotional_date: legacy.publish_date,
              title: legacy.title,
              scripture: legacy.scripture,
              memory_verse: "",
              body: legacy.content,
              prayer: "",
              created_at: legacy.created_at,
              updated_at: legacy.created_at,
            },
          },
        };
      }

      if (view === "devotional_manage") {
        await requireManage(auth, organizationId);
        const [{ data: series, error: seriesError }, { data: books, error: booksError }] = await Promise.all([
          admin.from("devotional_series").select("*").eq("organization_id", organizationId).order("devotional_year", { ascending: false }).order("created_at", { ascending: false }),
          admin.from("library_books").select("id,title,author_name,source_format,status").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        ]);
        if (seriesError || booksError) throw new ApiError("DEVOTIONAL_LOAD_FAILED", "Unable to load devotional management.", 500, undefined, false);
        return { data: { series: series ?? [], books: books ?? [] } };
      }

      if (view === "devotional_series") {
        const seriesId = uuid(url.searchParams.get("seriesId"), "seriesId", true)!;
        const { data: series, error } = await admin.from("devotional_series").select("*").eq("id", seriesId).eq("organization_id", organizationId).maybeSingle();
        if (error || !series) throw new ApiError("DEVOTIONAL_NOT_FOUND", "This devotional is unavailable.", 404);
        if (series.status !== "published") await requireManage(auth, organizationId);
        const { data: entries, error: entriesError } = await admin.from("devotional_entries").select("*").eq("series_id", seriesId).order("devotional_date");
        if (entriesError) throw new ApiError("DEVOTIONAL_LOAD_FAILED", "Unable to load devotional entries.", 500, undefined, false);
        return { data: { series, entries: entries ?? [] } };
      }

      throw new ApiError("VALIDATION_FAILED", "Unknown Library view.", 422);
    }

    if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Sign in to continue.", 401);
    const body = assertObject(await jsonBody(request));
    const action = requiredString(body.action, "action", 40);

    if (action === "create_book_upload") {
      await requireManage(auth, organizationId);
      const mimeType = requiredString(body.mimeType, "mimeType", 120).toLowerCase();
      const format = FORMATS[mimeType];
      if (!format) throw new ApiError("VALIDATION_FAILED", "Choose an EPUB or PDF book.", 422);
      const sizeBytes = integer(body.sizeBytes, "sizeBytes", 1, MAX_BOOK_BYTES);
      const fileName = safeFileName(body.fileName);
      const storagePath = `${organizationId}/${auth.user.id}/${crypto.randomUUID()}-${fileName.replace(/\.[^.]+$/, "")}.${format.ext}`;
      const { data, error } = await admin.storage.from(BOOK_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
      if (error || !data?.signedUrl) throw new ApiError("BOOK_UPLOAD_FAILED", "Unable to prepare the book upload.", 500, undefined, false);
      return { data: { signedUploadUrl: data.signedUrl, storagePath, sourceFormat: format.format, sizeBytes } };
    }

    if (action === "create_cover_upload") {
      await requireManage(auth, organizationId);
      const mimeType = requiredString(body.mimeType, "mimeType", 120).toLowerCase();
      const ext = COVER_TYPES[mimeType];
      if (!ext) throw new ApiError("VALIDATION_FAILED", "Choose a JPG, PNG or WebP cover.", 422);
      const storagePath = `${organizationId}/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage.from(COVER_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
      if (error || !data?.signedUrl) throw new ApiError("BOOK_COVER_UPLOAD_FAILED", "Unable to prepare the cover upload.", 500, undefined, false);
      return { data: { signedUploadUrl: data.signedUrl, storagePath, publicUrl: admin.storage.from(COVER_BUCKET).getPublicUrl(storagePath).data.publicUrl } };
    }

    if (action === "create_book") {
      await requireManage(auth, organizationId);
      const title = requiredString(body.title, "title", 180).trim();
      const authorName = requiredString(body.authorName, "authorName", 160).trim();
      const sourcePath = requiredString(body.sourcePath, "sourcePath", 600);
      const sourceFormat = requiredString(body.sourceFormat, "sourceFormat", 10);
      const rightsBasis = requiredString(body.rightsBasis, "rightsBasis", 30);
      const rightsAllowed = ["author_owned", "church_owned", "licensed", "public_domain", "other"];
      if (!["epub", "pdf"].includes(sourceFormat) || !rightsAllowed.includes(rightsBasis)) throw new ApiError("VALIDATION_FAILED", "Invalid book format or rights basis.", 422);
      if (!sourcePath.startsWith(`${organizationId}/${auth.user.id}/`)) throw new ApiError("BOOK_UPLOAD_INVALID", "This upload does not belong to your account.", 403);
      const redistributionConfirmed = booleanValue(body.redistributionConfirmed, "redistributionConfirmed");
      const status = String(body.status ?? "draft");
      if (!["draft", "published"].includes(status)) throw new ApiError("VALIDATION_FAILED", "Book status must be draft or published.", 422);
      if (status === "published") {
        await requirePublish(auth, organizationId);
        if (!redistributionConfirmed) throw new ApiError("BOOK_RIGHTS_REQUIRED", "Confirm distribution rights before publishing.", 422);
      }
      const coverPath = optionalText(body.coverPath, "coverPath", 600) || null;
      if (coverPath && !coverPath.startsWith(`${organizationId}/${auth.user.id}/`)) throw new ApiError("BOOK_COVER_INVALID", "This cover upload does not belong to your account.", 403);

      const { data: book, error } = await admin.from("library_books").insert({
        organization_id: organizationId,
        title,
        subtitle: optionalText(body.subtitle, "subtitle", 240),
        author_name: authorName,
        publisher: optionalText(body.publisher, "publisher", 160),
        isbn: optionalText(body.isbn, "isbn", 40) || null,
        description: optionalText(body.description, "description", 5000),
        source_format: sourceFormat,
        source_path: sourcePath,
        cover_path: coverPath,
        rights_basis: rightsBasis,
        rights_note: optionalText(body.rightsNote, "rightsNote", 1000),
        redistribution_confirmed: redistributionConfirmed,
        status: sourceFormat === "epub" ? "processing" : status,
        created_by_profile_id: auth.user.id,
        published_at: status === "published" && sourceFormat === "pdf" ? new Date().toISOString() : null,
      }).select("*").single();
      if (error || !book) throw new ApiError("BOOK_CREATE_FAILED", "Unable to create this book.", 500, undefined, false);

      if (sourceFormat === "epub") {
        try {
          const { data: blob, error: downloadError } = await admin.storage.from(BOOK_BUCKET).download(sourcePath);
          if (downloadError || !blob) throw new Error("Uploaded EPUB could not be read.");
          const chapters = parseEpub(new Uint8Array(await blob.arrayBuffer()));
          const { error: chapterError } = await admin.from("library_book_chapters").insert(chapters.map((chapter) => ({
            book_id: book.id,
            chapter_order: chapter.order,
            title: chapter.title,
            body: chapter.body,
            source_href: chapter.sourceHref,
          })));
          if (chapterError) throw new Error("Parsed chapters could not be saved.");
          await admin.from("library_books").update({
            status,
            published_at: status === "published" ? new Date().toISOString() : null,
          }).eq("id", book.id);
        } catch (value) {
          await admin.from("library_books").update({ status: "failed" }).eq("id", book.id);
          throw new ApiError("EPUB_PROCESSING_FAILED", value instanceof Error ? value.message : "Unable to prepare this EPUB.", 422);
        }
      }
      return { data: { ...book, status }, status: 201 };
    }

    if (action === "publish_book") {
      await requirePublish(auth, organizationId);
      const bookId = uuid(requiredString(body.bookId, "bookId", 36), "bookId", true)!;
      const book = await requireBook(admin, bookId, organizationId);
      if (!book.redistribution_confirmed) throw new ApiError("BOOK_RIGHTS_REQUIRED", "Confirm distribution rights before publishing.", 422);
      if (book.status === "failed" || book.status === "processing") throw new ApiError("BOOK_NOT_READY", "This book is not ready to publish.", 409);
      const { data, error } = await admin.from("library_books").update({ status: "published", published_at: new Date().toISOString() }).eq("id", bookId).select("*").single();
      if (error) throw new ApiError("BOOK_PUBLISH_FAILED", "Unable to publish this book.", 500, undefined, false);
      return { data };
    }

    if (action === "archive_book") {
      await requireManage(auth, organizationId);
      const bookId = uuid(requiredString(body.bookId, "bookId", 36), "bookId", true)!;
      const book = await requireBook(admin, bookId, organizationId);
      if (book.status === "published") await requirePublish(auth, organizationId);
      if (book.status === "processing") throw new ApiError("BOOK_NOT_READY", "Wait for this book to finish processing before disabling it.", 409);
      const { data, error } = await admin.from("library_books")
        .update({ status: "archived", published_at: null })
        .eq("id", bookId)
        .select("*")
        .single();
      if (error) throw new ApiError("BOOK_ARCHIVE_FAILED", "Unable to disable this book.", 500, undefined, false);
      return { data };
    }

    if (action === "restore_book") {
      await requireManage(auth, organizationId);
      const bookId = uuid(requiredString(body.bookId, "bookId", 36), "bookId", true)!;
      const book = await requireBook(admin, bookId, organizationId);
      if (book.status !== "archived") throw new ApiError("BOOK_NOT_ARCHIVED", "Only disabled books can be restored.", 409);
      const { data, error } = await admin.from("library_books")
        .update({ status: "draft", published_at: null })
        .eq("id", bookId)
        .select("*")
        .single();
      if (error) throw new ApiError("BOOK_RESTORE_FAILED", "Unable to restore this book.", 500, undefined, false);
      return { data };
    }

    if (action === "delete_book") {
      await requireManage(auth, organizationId);
      const bookId = uuid(requiredString(body.bookId, "bookId", 36), "bookId", true)!;
      const book = await requireBook(admin, bookId, organizationId);
      if (book.status === "published") throw new ApiError("BOOK_ARCHIVE_FIRST", "Disable this published book before deleting it.", 409);
      if (book.status === "processing") throw new ApiError("BOOK_NOT_READY", "Wait for this book to finish processing before deleting it.", 409);
      const { error } = await admin.from("library_books").delete().eq("id", bookId).eq("organization_id", organizationId);
      if (error) throw new ApiError("BOOK_DELETE_FAILED", "Unable to delete this book.", 500, undefined, false);
      if (book.source_path) await admin.storage.from(BOOK_BUCKET).remove([book.source_path]).catch(() => {});
      if (book.cover_path) await admin.storage.from(COVER_BUCKET).remove([book.cover_path]).catch(() => {});
      return { data: { deleted: true, bookId } };
    }

    if (action === "review") {
      const bookId = uuid(requiredString(body.bookId, "bookId", 36), "bookId", true)!;
      const book = await requireBook(admin, bookId, organizationId);
      if (book.status !== "published") throw new ApiError("BOOK_NOT_FOUND", "This book is unavailable.", 404);
      const rating = integer(body.rating, "rating", 1, 5);
      const reviewBody = optionalText(body.body, "body", 2000);
      const { data, error } = await admin.from("library_reviews").upsert({
        book_id: bookId, profile_id: auth.user.id, rating, body: reviewBody, updated_at: new Date().toISOString(),
      }, { onConflict: "book_id,profile_id" }).select("*").single();
      if (error) throw new ApiError("BOOK_REVIEW_FAILED", "Unable to save your review.", 500, undefined, false);
      return { data };
    }

    if (action === "progress") {
      const bookId = uuid(requiredString(body.bookId, "bookId", 36), "bookId", true)!;
      await requireBook(admin, bookId, organizationId);
      const chapterOrder = integer(body.chapterOrder ?? 0, "chapterOrder", 0, 100000);
      const pageIndex = integer(body.pageIndex ?? 0, "pageIndex", 0, 100000);
      const progressPercent = Math.max(0, Math.min(100, Number(body.progressPercent ?? 0)));
      if (!Number.isFinite(progressPercent)) throw new ApiError("VALIDATION_FAILED", "Invalid reading progress.", 422);
      const { data, error } = await admin.from("library_reading_progress").upsert({
        book_id: bookId, profile_id: auth.user.id, chapter_order: chapterOrder, page_index: pageIndex,
        progress_percent: progressPercent, updated_at: new Date().toISOString(),
      }, { onConflict: "book_id,profile_id" }).select("*").single();
      if (error) throw new ApiError("BOOK_PROGRESS_FAILED", "Unable to save reading progress.", 500, undefined, false);
      return { data };
    }

    if (action === "create_devotional_series") {
      await requireManage(auth, organizationId);
      const year = integer(body.year, "year", 2000, 2200);
      const bookId = optionalUuid(body.bookId, "bookId");
      if (bookId) await requireBook(admin, bookId, organizationId);
      const { data, error } = await admin.from("devotional_series").insert({
        organization_id: organizationId,
        book_id: bookId,
        title: requiredString(body.title, "title", 180).trim(),
        author_name: optionalText(body.authorName, "authorName", 160),
        devotional_year: year,
        description: optionalText(body.description, "description", 3000),
        status: "draft",
        created_by_profile_id: auth.user.id,
      }).select("*").single();
      if (error || !data) throw new ApiError("DEVOTIONAL_CREATE_FAILED", "Unable to create this devotional.", 500, undefined, false);
      return { data, status: 201 };
    }

    if (action === "attach_devotional_book") {
      await requireManage(auth, organizationId);
      const seriesId = uuid(requiredString(body.seriesId, "seriesId", 36), "seriesId", true)!;
      const bookId = uuid(requiredString(body.bookId, "bookId", 36), "bookId", true)!;
      const book = await requireBook(admin, bookId, organizationId);
      if (book.source_format !== "epub") throw new ApiError("DEVOTIONAL_EPUB_REQUIRED", "Daily devotional mapping requires an EPUB book.", 422);
      if (["archived", "failed", "processing"].includes(book.status)) throw new ApiError("DEVOTIONAL_BOOK_NOT_READY", "Choose an active EPUB that finished processing.", 409);
      const { data, error } = await admin.from("devotional_series")
        .update({ book_id: bookId, updated_at: new Date().toISOString() })
        .eq("id", seriesId)
        .eq("organization_id", organizationId)
        .select("*")
        .single();
      if (error) throw new ApiError("DEVOTIONAL_ATTACH_FAILED", "Unable to attach this EPUB to the devotional.", 500, undefined, false);
      return { data };
    }

    if (action === "import_devotional_from_book") {
      await requireManage(auth, organizationId);
      const seriesId = uuid(requiredString(body.seriesId, "seriesId", 36), "seriesId", true)!;
      const { data: series, error } = await admin.from("devotional_series").select("*").eq("id", seriesId).eq("organization_id", organizationId).maybeSingle();
      if (error || !series || !series.book_id) throw new ApiError("DEVOTIONAL_BOOK_REQUIRED", "Attach a Library book before importing daily entries.", 422);
      const { data: chapters, error: chapterError } = await admin.from("library_book_chapters").select("id,chapter_order,title,body").eq("book_id", series.book_id).order("chapter_order");
      if (chapterError) throw new ApiError("DEVOTIONAL_IMPORT_FAILED", "Unable to read the attached book.", 500, undefined, false);
      const mapped = (chapters ?? [])
        .map((chapter: any) => ({
          chapter,
          date: devotionalDateFromChapter(chapter.title, chapter.body, series.devotional_year),
          parsed: parseDevotionalChapter(chapter.title, chapter.body, series.devotional_year),
        }))
        .filter((item: any) => item.date);
      if (!mapped.length) throw new ApiError("DEVOTIONAL_DATES_NOT_FOUND", "No dated chapters were found. Add entries manually or include dates such as January 1 in the chapter heading or opening text.", 422);
      const rows = mapped.map(({ chapter, date, parsed }: any) => ({
        series_id: series.id,
        chapter_id: chapter.id,
        devotional_date: date,
        title: parsed.title,
        scripture: parsed.scripture,
        memory_verse: parsed.memoryVerse,
        body: parsed.body,
        prayer: parsed.prayer,
      }));
      const { error: importError } = await admin.from("devotional_entries").upsert(rows, { onConflict: "series_id,devotional_date" });
      if (importError) throw new ApiError("DEVOTIONAL_IMPORT_FAILED", "Unable to map the dated chapters.", 500, undefined, false);
      return { data: { mapped: rows.length, totalChapters: (chapters ?? []).length } };
    }

    if (action === "upsert_devotional_entry") {
      await requireManage(auth, organizationId);
      const seriesId = uuid(requiredString(body.seriesId, "seriesId", 36), "seriesId", true)!;
      const { data: series, error } = await admin.from("devotional_series").select("id,organization_id").eq("id", seriesId).eq("organization_id", organizationId).maybeSingle();
      if (error || !series) throw new ApiError("DEVOTIONAL_NOT_FOUND", "This devotional is unavailable.", 404);
      const date = isoDate(body.date);
      const { data, error: saveError } = await admin.from("devotional_entries").upsert({
        series_id: seriesId,
        devotional_date: date,
        title: optionalText(body.title, "title", 180),
        scripture: optionalText(body.scripture, "scripture", 1000),
        memory_verse: optionalText(body.memoryVerse, "memoryVerse", 1000),
        body: optionalText(body.body, "body", 30000),
        prayer: optionalText(body.prayer, "prayer", 5000),
        updated_at: new Date().toISOString(),
      }, { onConflict: "series_id,devotional_date" }).select("*").single();
      if (saveError) throw new ApiError("DEVOTIONAL_SAVE_FAILED", "Unable to save this devotional entry.", 500, undefined, false);
      return { data };
    }

    if (action === "publish_devotional_series") {
      await requirePublish(auth, organizationId);
      const seriesId = uuid(requiredString(body.seriesId, "seriesId", 36), "seriesId", true)!;
      const { data: series, error: seriesError } = await admin.from("devotional_series")
        .select("id,book_id")
        .eq("id", seriesId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (seriesError || !series) throw new ApiError("DEVOTIONAL_NOT_FOUND", "This devotional is unavailable.", 404);
      if (series.book_id) {
        const sourceBook = await requireBook(admin, series.book_id, organizationId);
        if (!sourceBook.redistribution_confirmed) throw new ApiError("BOOK_RIGHTS_REQUIRED", "Confirm distribution rights for the attached devotional book before publishing.", 422);
        if (["archived", "failed", "processing"].includes(sourceBook.status)) throw new ApiError("DEVOTIONAL_BOOK_NOT_READY", "The attached EPUB is not available for publishing.", 409);
      }
      const { count } = await admin.from("devotional_entries").select("*", { count: "exact", head: true }).eq("series_id", seriesId);
      if (!count) throw new ApiError("DEVOTIONAL_EMPTY", "Add at least one daily entry before publishing.", 422);
      const { data, error } = await admin.from("devotional_series").update({ status: "published", published_at: new Date().toISOString() }).eq("id", seriesId).eq("organization_id", organizationId).select("*").single();
      if (error) throw new ApiError("DEVOTIONAL_PUBLISH_FAILED", "Unable to publish this devotional.", 500, undefined, false);
      return { data };
    }

    throw new ApiError("VALIDATION_FAILED", "Unknown Library action.", 422);
  },
);

if (import.meta.main) Deno.serve(libraryHandler);
