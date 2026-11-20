export type SermonRichBlock = {
  id: string;
  type: 'paragraph' | 'highlight';
  text: string;
};

function blockId(index: number) {
  return `sermon-block-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeSermonBlocks(value: unknown, fallback = ''): SermonRichBlock[] {
  if (Array.isArray(value)) {
    const parsed = value
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const text = typeof row.text === 'string' ? row.text.trim() : '';
        if (!text) return null;
        return {
          id: typeof row.id === 'string' && row.id ? row.id : blockId(index),
          type: row.type === 'highlight' ? 'highlight' as const : 'paragraph' as const,
          text,
        };
      })
      .filter(Boolean) as SermonRichBlock[];
    if (parsed.length) return parsed;
  }
  return parseSermonMarkdown(fallback);
}

export function parseSermonMarkdown(value?: string | null): SermonRichBlock[] {
  const source = (value ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) return [];

  return source
    .split(/\n\s*\n/g)
    .map((part, index) => {
      const text = part.trim();
      if (!text) return null;
      const highlight = /^\*\*[\s\S]+\*\*$/.test(text);
      const clean = highlight ? text.slice(2, -2).trim() : text;
      if (!clean) return null;
      return {
        id: blockId(index),
        type: highlight ? 'highlight' as const : 'paragraph' as const,
        text: clean,
      };
    })
    .filter(Boolean) as SermonRichBlock[];
}

export function sermonBlocksToMarkdown(blocks: SermonRichBlock[]) {
  return blocks
    .map((block) => {
      const text = block.text.trim();
      if (!text) return '';
      return block.type === 'highlight' ? `**${text}**` : text;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function sermonBlocksToPlainText(blocks: SermonRichBlock[]) {
  return blocks.map((block) => block.text.trim()).filter(Boolean).join('\n\n');
}

export function sermonExcerpt(blocks: SermonRichBlock[], max = 700) {
  const text = sermonBlocksToPlainText(blocks).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function newSermonBlock(type: SermonRichBlock['type'] = 'paragraph'): SermonRichBlock {
  return { id: blockId(0), type, text: '' };
}
