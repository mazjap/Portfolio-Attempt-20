import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarkdownRenderer from '../components/shared/MarkdownRenderer';
import {
  MAX_CODE_LINES,
  MAX_HEADING_CHARS,
  codeLines,
  grabOffset,
  indicatorRect,
  maxScrollTop,
  minimapScale,
  sampleEvenly,
  scanBlocks,
  scrollTopForClick,
  scrollTopForDrag,
  type MinimapSize,
} from './minimap';

// An 8000 px page, an 800 px viewport, and a minimap 752 px tall: 0.094 minimap pixels per page pixel.
const size: MinimapSize = { totalH: 8000, viewH: 800, containerH: 752 };

describe('minimap geometry', () => {
  it('draws the viewport at the same scale as the page', () => {
    expect(minimapScale(size)).toBeCloseTo(0.094);
    expect(maxScrollTop(size)).toBe(7200);
    const { top, height } = indicatorRect(1600, size);
    expect(top).toBeCloseTo(150.4);
    expect(height).toBeCloseTo(75.2);
    // Scrolled all the way down, the indicator's bottom edge meets the minimap's.
    const end = indicatorRect(7200, size);
    expect(end.top + end.height).toBeCloseTo(752);
  });

  it('never makes the indicator taller than the minimap', () => {
    expect(indicatorRect(0, { totalH: 500, viewH: 800, containerH: 752 }).height).toBe(752);
    expect(maxScrollTop({ totalH: 500, viewH: 800, containerH: 752 })).toBe(0);
  });

  it('centers the viewport on a click, so the indicator lands where you clicked', () => {
    const top = scrollTopForClick(376, size); // the middle of the minimap
    expect(top).toBeCloseTo(3600);
    const { top: t, height } = indicatorRect(top, size);
    expect(t + height / 2).toBeCloseTo(376);
  });

  it('keeps clicks near either end inside the page', () => {
    expect(scrollTopForClick(0, size)).toBe(0);
    expect(scrollTopForClick(5, size)).toBe(0);
    expect(scrollTopForClick(752, size)).toBe(7200);
  });

  it('keeps the grabbed point under the pointer while dragging', () => {
    const scrollY = 1600;
    const { top } = indicatorRect(scrollY, size);
    const y = top + 20; // pressed 20 px below the indicator's top edge
    const grab = grabOffset(y, scrollY, size);
    expect(grab).toBeCloseTo(20);
    // With no movement the page doesn't move.
    expect(scrollTopForDrag(y, grab, size)).toBeCloseTo(scrollY);
    // Moving the pointer 100 px moves the indicator exactly 100 px.
    const next = scrollTopForDrag(y + 100, grab, size);
    expect(indicatorRect(next, size).top).toBeCloseTo(top + 100);
  });

  it('clamps a drag past either end', () => {
    expect(scrollTopForDrag(-300, 20, size)).toBe(0);
    expect(scrollTopForDrag(5000, 20, size)).toBe(7200);
  });
});

describe('scanning an article', () => {
  // Each block says where it is with data-top and data-h; images say they have loaded with data-loaded.
  let rects: ReturnType<typeof vi.spyOn>[];
  beforeEach(() => {
    rects = [
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const top = Number((this as HTMLElement).dataset.top ?? 0);
        return { top, height: Number((this as HTMLElement).dataset.h ?? 0), width: Number((this as HTMLElement).dataset.w ?? 600) } as DOMRect;
      }),
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return Number(this.dataset.h ?? 0);
      }),
      vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(function (this: HTMLImageElement) {
        return this.dataset.loaded !== undefined;
      }),
      vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(function (this: HTMLImageElement) {
        return this.dataset.loaded !== undefined ? 800 : 0;
      }),
      vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get').mockImplementation(function (this: HTMLImageElement) {
        return this.dataset.loaded ?? '';
      }),
    ];
  });
  afterEach(() => rects.forEach(spy => spy.mockRestore()));

  function scan(html: string) {
    const root = document.createElement('article');
    root.innerHTML = html;
    document.body.append(root);
    const found = scanBlocks(root);
    root.remove();
    return found;
  }

  it('finds each kind of block, where it is', () => {
    const found = scan(`
      <h2 data-top="10" data-h="30">Title</h2>
      <p data-top="60" data-h="80">Text</p>
      <ul data-top="150" data-h="60"><li><p data-top="150" data-h="20">nested</p></li></ul>
      <blockquote data-top="220" data-h="40">Quote</blockquote>
      <hr data-top="270" data-h="2" />
      <table data-top="280" data-h="90"><tbody><tr><td><p data-top="280" data-h="20">cell</p></td></tr></tbody></table>
    `);
    expect(found.map(f => [f.type, f.absTop, f.height])).toEqual([
      ['heading', 10, 30], ['paragraph', 60, 80], ['list', 150, 60], ['blockquote', 220, 40], ['hr', 270, 1], ['table', 280, 90],
    ]);
    expect(found[0].level).toBe(2);
  });

  it('reads a heading as its words: no permalink, one line, shortened', () => {
    const [short, long] = scan(`
      <h1 data-top="0" data-h="30">  The <em>big</em>
        plan <a data-heading-anchor href="#x" aria-label="Link to this section">#</a></h1>
      <h3 data-top="50" data-h="20">${'word '.repeat(60)}</h3>
    `);
    expect(short.text).toBe('The big plan');
    expect(long.text).toHaveLength(MAX_HEADING_CHARS);
    expect(long.text!.endsWith('…')).toBe(true);
  });

  it('keeps a link that is part of the heading', () => {
    const [h] = scan('<h2 data-top="0" data-h="30">See <a href="/x">the docs</a></h2>');
    expect(h.text).toBe('See the docs');
  });

  it('draws a paragraph that is only an image as that image (Markdown wraps a lone image in a <p>)', () => {
    const found = scan(`
      <p data-top="100" data-h="500"><img src="/a.webp" alt="First" data-top="100" data-h="240" data-loaded="/a.w1280.webp"><img src="/b.webp" alt="" data-top="360" data-h="240"></p>
    `);
    expect(found.map(f => f.type)).toEqual(['image', 'image']);
    expect(found[0]).toMatchObject({ absTop: 100, height: 240, thumb: '/a.w1280.webp', alt: 'First' });
    // The second hasn't loaded, so there's nothing to show yet (not a download of its own).
    expect(found[1].thumb).toBeUndefined();
    expect(found[1].alt).toBeUndefined();
  });

  it('keeps a paragraph that has words as well as an image', () => {
    const found = scan('<p data-top="0" data-h="100">See <img src="/a.webp" alt="" data-top="20" data-h="40"> here</p>');
    expect(found.map(f => f.type)).toEqual(['paragraph']);
  });

  it('draws an image in a list or quote as part of that block, but a figure as an image', () => {
    const found = scan(`
      <blockquote data-top="0" data-h="200"><p><img src="/a.webp" alt="" data-top="10" data-h="100"></p></blockquote>
      <figure data-top="300" data-h="150"><img src="/b.webp" alt="Fig" data-top="300" data-h="120" data-loaded="/b.w640.webp"><figcaption>Cap</figcaption></figure>
    `);
    expect(found.map(f => f.type)).toEqual(['blockquote', 'image']);
    expect(found[1].thumb).toBe('/b.w640.webp');
  });

  it('skips blocks with no height (an image that has not loaded and has no box yet)', () => {
    expect(scan('<p data-top="0" data-h="0"><img src="/a.webp" alt="" data-top="0" data-h="0"></p><p data-top="9" data-h="20">x</p>').map(f => f.type)).toEqual(['paragraph']);
  });

  it('leaves out small images, like the gallery strip of thumbnails', () => {
    const found = scan(`
      <div><button><img src="/a.webp" alt="" data-top="500" data-h="36" data-w="60"></button><button><img src="/b.webp" alt="" data-top="500" data-h="36" data-w="60"></button></div>
      <img src="/c.webp" alt="" data-top="100" data-h="300" data-w="600">
    `);
    expect(found.map(f => [f.type, f.absTop])).toEqual([['image', 100]]);
  });

  it('outlines code line by line, with comments from the highlighter', () => {
    const [code] = scan(
      '<pre data-top="0" data-h="100"><code>const a = 1;\n    nested();\n\n<span class="hljs-comment">// note</span></code></pre>',
    );
    expect(code.type).toBe('code');
    expect(code.lines).toHaveLength(4);
    expect(code.lines![0]).toMatchObject({ left: 0, comment: false });
    expect(code.lines![1].left).toBeGreaterThan(0); // indented
    expect(code.lines![2].width).toBe(0); // blank
    expect(code.lines![3].comment).toBe(true);
  });

  it('reads comments out of code the site actually highlights', () => {
    // The real thing: rehype-highlight's output for Swift and C.
    const html = renderToStaticMarkup(
      createElement(MarkdownRenderer, {
        content: [
          '```swift',
          '#if DEBUG',
          '// just a comment',
          'let x = 1 // trailing',
          '/* a block',
          '   comment */',
          '#endif',
          '```',
        ].join('\n'),
      }),
    ).replace(/<pre/, '<pre data-top="0" data-h="200"');
    const [code] = scan(html);
    expect(code.lines!.map(l => l.comment)).toEqual([false, true, false, true, true, false]);
  });
});

/** A block of code with no highlighting. */
const plain = (text: string) => [{ text, comment: false }];

describe('codeLines', () => {
  it('measures each line against the longest, counting indentation', () => {
    const lines = codeLines(plain('ab\n    abcd\n'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ left: 0, width: 2 / 8, comment: false });
    expect(lines[1]).toEqual({ left: 4 / 8, width: 4 / 8, comment: false });
  });

  it('treats tabs as indentation', () => {
    expect(codeLines(plain('\tfoo\nfoo'))[0].left).toBeGreaterThan(0);
  });

  it('does not guess comments from how a line starts', () => {
    // `#if` and `#include` are code, `*ptr = x` and `- item` are code or prose, whatever the language.
    const lines = codeLines(plain('#if DEBUG\n#include <a.h>\n*ptr = x;\n- item\n-- sql\n// x'));
    expect(lines.some(l => l.comment)).toBe(false);
  });

  it('marks a line as a comment only when all of it is in a comment', () => {
    const lines = codeLines([
      { text: '#if DEBUG\n', comment: false },
      { text: '// x', comment: true },
      { text: '\n', comment: false },
      { text: '/* one\n  two\n  three */', comment: true },
      { text: '\nlet a = 1 ', comment: false },
      { text: '// why', comment: true },
    ]);
    expect(lines.map(l => l.comment)).toEqual([false, true, true, true, true, false]);
  });

  it('is deterministic, and never keeps more than the cap, sampling evenly', () => {
    const source = Array.from({ length: 500 }, (_, i) => 'x'.repeat(i % 40)).join('\n');
    const a = codeLines(plain(source));
    expect(a).toHaveLength(MAX_CODE_LINES);
    expect(codeLines(plain(source))).toEqual(a);
    expect(codeLines(plain(source), 10)).toHaveLength(10);
  });

  it('handles empty code', () => {
    expect(codeLines(plain(''))).toEqual([{ left: 0, width: 0, comment: false }]);
    expect(codeLines([])).toEqual([{ left: 0, width: 0, comment: false }]);
  });
});

describe('sampleEvenly', () => {
  it('keeps everything when there is room', () => {
    expect(sampleEvenly([1, 2, 3], 3)).toEqual([1, 2, 3]);
    expect(sampleEvenly([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('spreads the picks across the whole list, in order', () => {
    expect(sampleEvenly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5)).toEqual([0, 2, 4, 6, 8]);
    expect(sampleEvenly([1, 2, 3], 0)).toEqual([]);
  });
});
