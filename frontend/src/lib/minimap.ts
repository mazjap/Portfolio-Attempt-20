// The scroll minimap's geometry. One mapping serves everything: a point `y` of the document is drawn
// at `y * scale` pixels down the minimap (scale = minimap height / document height), so the bars, the
// viewport indicator, clicks, and drags all agree. The indicator is the viewport drawn at that scale.

export interface MinimapSize {
  /** Height of the whole document (`scrollHeight`). */
  totalH: number;
  /** Height of the viewport (`innerHeight`). */
  viewH: number;
  /** Height of the minimap itself, in pixels. */
  containerH: number;
}

export function minimapScale({ totalH, containerH }: MinimapSize): number {
  return containerH / Math.max(totalH, 1);
}

/** The furthest the page can be scrolled. */
export function maxScrollTop({ totalH, viewH }: MinimapSize): number {
  return Math.max(totalH - viewH, 0);
}

function clampScrollTop(top: number, size: MinimapSize): number {
  return Math.min(Math.max(top, 0), maxScrollTop(size));
}

/** Where the viewport indicator sits in the minimap, in pixels. */
export function indicatorRect(scrollY: number, size: MinimapSize): { top: number; height: number } {
  const scale = minimapScale(size);
  return {
    top: scrollY * scale,
    height: Math.min(size.viewH * scale, size.containerH),
  };
}

/** The scroll position for a click `y` pixels down the minimap: the viewport is centered on that point. */
export function scrollTopForClick(y: number, size: MinimapSize): number {
  return clampScrollTop(y / minimapScale(size) - size.viewH / 2, size);
}

/** How far below the indicator's top edge a press at `y` is, so a drag can keep that point under the pointer. */
export function grabOffset(y: number, scrollY: number, size: MinimapSize): number {
  return y - indicatorRect(scrollY, size).top;
}

/** The scroll position for a drag whose pointer is now `y` pixels down the minimap. */
export function scrollTopForDrag(y: number, grab: number, size: MinimapSize): number {
  return clampScrollTop((y - grab) / minimapScale(size), size);
}

// ---------------------------------------------------------------------------------------------
// Scanning the article
// ---------------------------------------------------------------------------------------------

export type ElType = 'heading' | 'paragraph' | 'list' | 'image' | 'code' | 'blockquote' | 'hr' | 'table';

/** One line of a code block, as a fraction of the longest line. */
export interface CodeLine {
  /** How far in the line starts (its indentation), 0 to 1. */
  left: number;
  /** How long the line is, 0 to 1. Blank lines are 0. */
  width: number;
  /** A comment, which is drawn in a different color. */
  comment: boolean;
}

export interface ContentEl {
  type: ElType;
  /** Distance from the top of the document, in page pixels. */
  absTop: number;
  height: number;
  level?: number;
  /** Headings: what it says (single line, shortened). */
  text?: string;
  /** Images: the URL the article itself loaded, once it has loaded, so the thumbnail comes from cache. */
  thumb?: string;
  /** Images: the alt text. */
  alt?: string;
  /** Code: a line-by-line outline, at most MAX_CODE_LINES long. */
  lines?: CodeLine[];
}

/** Longest heading text kept; the minimap shows far less, and the hover preview wraps it. */
export const MAX_HEADING_CHARS = 100;
/** Most lines kept for a code block. A longer block is sampled evenly, so a huge file stays cheap. */
export const MAX_CODE_LINES = 60;

/** Images narrower than this (in page pixels) are left out. */
export const MIN_IMAGE_WIDTH = 120;

const SELECTOR = 'h1, h2, h3, h4, p, ul, ol, pre, img, figure, blockquote, hr, table';
const SCAN_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'P', 'UL', 'OL', 'PRE', 'IMG', 'FIGURE', 'BLOCKQUOTE', 'HR', 'TABLE']);

/**
 * Whether a block is already drawn as part of an enclosing one (a `<p>` inside a list item is part of
 * the list). Markdown wraps a lone image in a `<p>`, so an image is not covered by a paragraph that is
 * only images; an image in a line of text stays part of the paragraph.
 */
function isCovered(el: Element, root: Element): boolean {
  const isImage = el.tagName === 'IMG';
  for (let parent = el.parentElement; parent && parent !== root; parent = parent.parentElement) {
    if (!SCAN_TAGS.has(parent.tagName)) continue;
    if (isImage && parent.tagName === 'P' && !hasText(parent)) continue;
    return true;
  }
  return false;
}

const hasText = (el: Element) => (el.textContent ?? '').trim() !== '';

/** The heading's words: no `#` permalink, whitespace collapsed, shortened. */
export function headingText(el: Element): string {
  let text = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    else if (node instanceof Element && !node.hasAttribute('data-heading-anchor')) node.childNodes.forEach(walk);
  };
  walk(el);
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > MAX_HEADING_CHARS ? `${text.slice(0, MAX_HEADING_CHARS - 1)}…` : text;
}

/** At most `count` of the items, evenly spaced and in order (all of them if there are no more than that). */
export function sampleEvenly<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: Math.max(count, 0) }, (_, i) => items[Math.floor((i * items.length) / count)]);
}

const TAB_WIDTH = 4;

/** A run of code text, and whether the highlighter marked it as part of a comment. */
export interface CodeSegment {
  text: string;
  comment: boolean;
}

/**
 * The text of a highlighted `<pre>` as segments. `rehype-highlight` wraps comments (including each
 * line of a block comment, and any doc tags inside it) in `.hljs-comment`, so the minimap doesn't
 * have to guess from how a line starts (`#if` is code in Swift, a comment in Python).
 */
export function codeSegments(pre: Element): CodeSegment[] {
  const segments: CodeSegment[] = [];
  const walk = (node: Node, comment: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      segments.push({ text: node.textContent ?? '', comment });
    } else if (node instanceof Element) {
      const inComment = comment || node.classList.contains('hljs-comment');
      node.childNodes.forEach(child => walk(child, inComment));
    }
  };
  walk(pre, false);
  return segments;
}

/**
 * An outline of some code: each line's indent and length relative to the longest line, which is
 * enough to draw it as little marks. A line is a comment when everything on it that isn't whitespace
 * is in a comment segment, so code with a trailing comment is not. Deterministic, and cheap (one pass
 * over the segments, then at most `max` lines kept: a longer block is sampled evenly).
 */
export function codeLines(segments: readonly CodeSegment[], max = MAX_CODE_LINES): CodeLine[] {
  const rows = [{ text: '', chars: 0, commentChars: 0 }];
  for (const { text, comment } of segments) {
    text.split('\n').forEach((piece, i) => {
      if (i > 0) rows.push({ text: '', chars: 0, commentChars: 0 });
      const row = rows[rows.length - 1];
      const chars = piece.replace(/\s/g, '').length;
      row.text += piece;
      row.chars += chars;
      if (comment) row.commentChars += chars;
    });
  }
  while (rows.length > 1 && rows[rows.length - 1].chars === 0) rows.pop();

  const measured = rows.map(row => {
    const expanded = row.text.replace(/\t/g, ' '.repeat(TAB_WIDTH)).replace(/\s+$/, '');
    const text = expanded.trimStart();
    return {
      indent: expanded.length - text.length,
      length: text.length,
      comment: row.chars > 0 && row.commentChars === row.chars,
    };
  });
  const longest = Math.max(1, ...measured.map(m => m.indent + m.length));
  return sampleEvenly(measured, max).map(m => ({ left: m.indent / longest, width: m.length / longest, comment: m.comment }));
}

/** Everything on the page the minimap draws, with where it is. Zero-height blocks are skipped. */
export function scanBlocks(root: HTMLElement): ContentEl[] {
  const found: ContentEl[] = [];
  root.querySelectorAll(SELECTOR).forEach(node => {
    if (isCovered(node, root)) return;
    const tag = node.tagName;
    const el = node as HTMLElement;

    // A paragraph that is only images is drawn as those images (a lone Markdown image is a `<p>`).
    if (tag === 'P' && el.querySelector('img') && !hasText(el)) return;

    const rect = el.getBoundingClientRect();
    const absTop = rect.top + window.scrollY;
    // Small images (the gallery's strip of thumbnails, icons) aren't content worth a bar, and a row
    // of them would all be drawn on top of each other.
    if (tag === 'IMG' && rect.width < MIN_IMAGE_WIDTH) return;
    const height = tag === 'HR' ? 1 : (el.offsetHeight || rect.height);
    if (height < 1 && tag !== 'HR') return;

    const hMatch = /^H(\d)$/.exec(tag);
    const base = { absTop, height: Math.max(height, tag === 'HR' ? 1 : 3) };

    if (hMatch) {
      found.push({ ...base, type: 'heading', level: parseInt(hMatch[1]), text: headingText(el) });
    } else if (tag === 'P') {
      found.push({ ...base, type: 'paragraph' });
    } else if (tag === 'UL' || tag === 'OL') {
      found.push({ ...base, type: 'list' });
    } else if (tag === 'IMG' || tag === 'FIGURE') {
      const img = tag === 'IMG' ? (el as HTMLImageElement) : el.querySelector('img');
      // The URL the article loaded, so the thumbnail is a cache hit and no extra file is fetched.
      const thumb = img && img.complete && img.naturalWidth > 0 ? img.currentSrc || img.src : undefined;
      found.push({ ...base, type: 'image', thumb, alt: img?.alt || undefined });
    } else if (tag === 'PRE') {
      found.push({ ...base, type: 'code', lines: codeLines(codeSegments(el)) });
    } else if (tag === 'BLOCKQUOTE') {
      found.push({ ...base, type: 'blockquote' });
    } else if (tag === 'HR') {
      found.push({ ...base, type: 'hr' });
    } else if (tag === 'TABLE') {
      found.push({ ...base, type: 'table' });
    }
  });
  return found;
}
