import { unzipSync } from "npm:fflate@0.8.2";

export type ParsedBookChapter = {
  order: number;
  title: string;
  body: string;
  sourceHref: string;
};

const decoder = new TextDecoder();

function decodeXml(bytes?: Uint8Array) {
  return bytes ? decoder.decode(bytes) : "";
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}

function directoryOf(path: string) {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index + 1) : "";
}

function normalizePath(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveRelative(baseFile: string, href: string) {
  if (!href) return "";
  const clean = href.split("#")[0].split("?")[0];
  return normalizePath(directoryOf(baseFile) + clean);
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘",
    rdquo: "”", ldquo: "“",
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => named[name.toLowerCase()] ?? whole);
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|div|section|article|h[1-6]|li|blockquote)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chapterTitle(html: string, fallback: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
    ?? "";
  const text = htmlToText(title).slice(0, 180).trim();
  return text || fallback;
}

export function parseEpub(bytes: Uint8Array): ParsedBookChapter[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("This EPUB file could not be opened.");
  }

  const container = decodeXml(files["META-INF/container.xml"]);
  const opfPath = container.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!opfPath || !files[opfPath]) throw new Error("This EPUB is missing its package manifest.");

  const opf = decodeXml(files[opfPath]);
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const tag of opf.match(/<item\b[^>]*>/gi) ?? []) {
    const id = attr(tag, "id");
    const href = attr(tag, "href");
    if (!id || !href) continue;
    manifest.set(id, { href, mediaType: attr(tag, "media-type") });
  }

  const spineIds = (opf.match(/<itemref\b[^>]*>/gi) ?? [])
    .map((tag) => attr(tag, "idref"))
    .filter(Boolean);

  const ordered = spineIds.length ? spineIds : [...manifest.keys()];
  const chapters: ParsedBookChapter[] = [];
  for (const id of ordered) {
    const item = manifest.get(id);
    if (!item || !/(xhtml|html)/i.test(item.mediaType || item.href)) continue;
    const path = resolveRelative(opfPath, item.href);
    const html = decodeXml(files[path]);
    if (!html) continue;
    const body = htmlToText(html);
    if (!body) continue;
    chapters.push({
      order: chapters.length,
      title: chapterTitle(html, `Chapter ${chapters.length + 1}`),
      body,
      sourceHref: item.href,
    });
  }

  if (!chapters.length) throw new Error("No readable chapters were found in this EPUB.");
  return chapters;
}

const MONTHS: Record<string, number> = {
  january:1, jan:1, february:2, feb:2, march:3, mar:3, april:4, apr:4,
  may:5, june:6, jun:6, july:7, jul:7, august:8, aug:8, september:9, sep:9, sept:9,
  october:10, oct:10, november:11, nov:11, december:12, dec:12,
};

export function devotionalDateFromTitle(title: string, year: number) {
  const value = title.trim();
  let match = value.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return date.toISOString().slice(0, 10);
  }
  match = value.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const month = first <= 12 ? first : second;
    const day = first <= 12 ? second : first;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return date.toISOString().slice(0, 10);
  }
  return null;
}
