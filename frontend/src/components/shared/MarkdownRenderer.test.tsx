import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarkdownRenderer from './MarkdownRenderer';

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
    expect(container.querySelector('table')?.parentElement?.className).toContain('overflow-x-auto');
  });
});
