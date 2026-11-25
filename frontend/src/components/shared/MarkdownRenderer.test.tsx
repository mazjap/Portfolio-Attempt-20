import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarkdownRenderer from './MarkdownRenderer';

const originalMatchMedia = window.matchMedia;
/** Pretends the window is (or isn't) at least 1280 px wide, where the scroll minimap shows. */
function setXl(isXl: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isXl && query.includes('min-width: 1280px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

const renderMarkdown = (content: string) =>
  render(<MemoryRouter><MarkdownRenderer content={content} /></MemoryRouter>).container;

describe('MarkdownRenderer', () => {
  it('keeps the start number of ordered lists', () => {
    expect(renderMarkdown('3. three\n4. four').querySelector('ol')?.getAttribute('start')).toBe('3');
  });

  it('renders a fence without a language as a code block, not inline code', () => {
    const code = renderMarkdown('```\nplain block\n```').querySelector('pre > code');
    expect(code?.className).toContain('block');
    expect(code?.className).not.toContain('text-xcode-pink');
  });

  it('opens only other sites in a new tab', () => {
    const links = renderMarkdown('[post](/blog/x) [anchor](#part) [ext](https://example.com) [feed](/feed.xml)').querySelectorAll('a');
    const byText = (t: string) => [...links].find(a => a.textContent === t)!;
    expect(byText('post').getAttribute('href')).toBe('/blog/x');
    expect(byText('post').getAttribute('target')).toBeNull();
    expect(byText('anchor').getAttribute('target')).toBeNull();
    expect(byText('ext').getAttribute('target')).toBe('_blank');
    expect(byText('feed').getAttribute('target')).toBeNull();
  });

  it('gives headings anchors and wraps tables so they scroll', () => {
    const container = renderMarkdown('## Getting Started\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    const heading = container.querySelector('h2');
    expect(heading?.id).toBe('getting-started');
    expect(heading?.querySelector('a')?.getAttribute('href')).toBe('#getting-started');
    // The scroll minimap leaves the permalink out of the heading text it shows.
    expect(heading?.querySelector('a')?.hasAttribute('data-heading-anchor')).toBe(true);
    expect(container.querySelector('table')?.parentElement?.className).toContain('overflow-x-auto');
  });

  describe('images', () => {
    it('loads them eagerly where the minimap shows, holding a box until they have loaded', () => {
      // A lazy image has no height until it loads, so the page (and the scroll minimap) used to jump
      // as the reader reached each one.
      setXl(true);
      const img = renderMarkdown('![shot](/media/posts/x/a.webp)').querySelector('img')!;
      expect(img.getAttribute('loading')).toBe('eager');
      // No explicit fetch priority: the browser boosts an image that is already in view.
      expect(img.hasAttribute('fetchpriority')).toBe(false);
      expect(img.className).toContain('aspect-[auto_4/3]');
      expect(img.getAttribute('alt')).toBe('shot');
    });

    it('stays lazy below that width, where there is no minimap, but still holds the box', () => {
      setXl(false);
      const img = renderMarkdown('![shot](/media/posts/x/a.webp)').querySelector('img')!;
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.className).toContain('aspect-[auto_4/3]');
    });

    it('drops the box when the image cannot be loaded, instead of leaving a gap', () => {
      const img = renderMarkdown('![gone](https://example.com/gone.png)').querySelector('img')!;
      fireEvent.error(img);
      expect(img.className).not.toContain('aspect-');
    });

    it('tries the full-size file before giving up on a missing smaller size', () => {
      const img = renderMarkdown('![old](/media/posts/x/old.webp)').querySelector('img')!;
      expect(img.hasAttribute('srcset')).toBe(true);
      fireEvent.error(img); // the .w640/.w1280 files aren't there
      expect(img.hasAttribute('srcset')).toBe(false);
      expect(img.className).toContain('aspect-[auto_4/3]');
      fireEvent.error(img); // neither is the original
      expect(img.className).not.toContain('aspect-');
    });

    it('starts the next image fresh, even in the same position', () => {
      const { container, rerender } = render(<MemoryRouter><MarkdownRenderer content="![a](https://example.com/a.png)" /></MemoryRouter>);
      fireEvent.error(container.querySelector('img')!);
      rerender(<MemoryRouter><MarkdownRenderer content="![b](https://example.com/b.png)" /></MemoryRouter>);
      expect(container.querySelector('img')!.className).toContain('aspect-[auto_4/3]');
    });
  });
});
