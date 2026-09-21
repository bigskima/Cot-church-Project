export type ReaderContent = {
  heading: string;
  scripture: string;
  memoryVerse: string;
  paragraphs: string[];
  prayer: string;
  speechText: string;
};

const DATE_HEADING = /^(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?$/i;
const PAGE_LABEL = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
const DECORATIVE = /^(?:[•·◆◇▪▫■□●○◆❖✦✧★☆*_=~—–\-\s]){3,}$/;

function comparable(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function removeReadingNoise(lines: string[], chapterTitle: string) {
  const chapterKey = comparable(chapterTitle);
  const result: string[] = [];
  let previous = '';

  for (const source of lines) {
    const line = normalizeLine(source);
    if (!line || PAGE_LABEL.test(line) || DECORATIVE.test(line)) continue;

    const key = comparable(line);
    if (!key || key === previous) continue;

    // EPUB generators commonly repeat the visible date/chapter heading two or
    // three times through nested heading elements. The reader already shows the
    // chapter heading separately, so suppress those duplicates from body/TTS.
    if (result.length < 3 && chapterKey && key === chapterKey) {
      previous = key;
      continue;
    }
    if (result.length < 3 && DATE_HEADING.test(line) && DATE_HEADING.test(chapterTitle)) {
      previous = key;
      continue;
    }

    result.push(line);
    previous = key;
  }
  return result;
}

function splitParagraphs(lines: string[]) {
  const paragraphs: string[] = [];
  let current = '';
  for (const line of lines) {
    if (!current) {
      current = line;
      continue;
    }
    if (current.length + line.length < 420 && !/[.!?]["'’”)]?$/.test(current)) {
      current += ` ${line}`;
    } else {
      paragraphs.push(current);
      current = line;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

export function parseReaderContent(chapterTitle: string, pageText: string, allowPageHeading = true): ReaderContent {
  const lines = removeReadingNoise(pageText.replace(/\r/g, '').split(/\n+/), chapterTitle);
  let heading = '';
  let scripture = '';
  let memoryVerse = '';
  let prayer = '';
  const bodyLines: string[] = [];
  let inPrayer = false;

  for (const line of lines) {
    const scriptureMatch = line.match(/^(?:scripture|bible reading|reading)\s*[:\-–—]\s*(.+)$/i);
    if (scriptureMatch && !scripture) {
      scripture = scriptureMatch[1].trim();
      continue;
    }

    const memoryMatch = line.match(/^(?:memory verse|key verse|verse)\s*[:\-–—]\s*(.+)$/i);
    if (memoryMatch && !memoryVerse) {
      memoryVerse = memoryMatch[1].trim();
      continue;
    }

    const prayerInline = line.match(/^(?:prayer|prayer\s*\/\s*reflection|reflection)\s*[:\-–—]\s*(.+)$/i);
    if (prayerInline) {
      inPrayer = true;
      prayer = prayerInline[1].trim();
      continue;
    }
    if (/^(?:prayer|prayer\s*\/\s*reflection|reflection)$/i.test(line)) {
      inPrayer = true;
      continue;
    }

    if (
      allowPageHeading
      && !heading
      && !inPrayer
      && line.length <= 140
      && !DATE_HEADING.test(line)
      && !/^(?:scripture|memory verse|key verse|bible reading|reading)\b/i.test(line)
    ) {
      heading = line;
      continue;
    }

    if (inPrayer) prayer += `${prayer ? ' ' : ''}${line}`;
    else bodyLines.push(line);
  }

  const paragraphs = splitParagraphs(bodyLines);
  const spoken = [
    heading && comparable(heading) !== comparable(chapterTitle) ? heading : '',
    scripture ? `Scripture. ${scripture}` : '',
    memoryVerse ? `Memory verse. ${memoryVerse}` : '',
    ...paragraphs,
    prayer ? `Prayer and reflection. ${prayer}` : '',
  ].filter(Boolean);

  return {
    heading,
    scripture,
    memoryVerse,
    paragraphs,
    prayer,
    speechText: spoken.join('. ').replace(/\s+/g, ' ').trim(),
  };
}

export function cleanPdfSpeechText(value: string) {
  const lines = value
    .replace(/\r/g, '')
    .split(/\n+/)
    .map(normalizeLine)
    .filter((line) => line && !PAGE_LABEL.test(line) && !DECORATIVE.test(line));

  const deduped: string[] = [];
  let previous = '';
  for (const line of lines) {
    const key = comparable(line);
    if (!key || key === previous) continue;
    deduped.push(line);
    previous = key;
  }

  return deduped
    .join('\n')
    .replace(/([A-Za-z])[-‐‑]\s*\n\s*([a-z])/g, '$1$2')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
