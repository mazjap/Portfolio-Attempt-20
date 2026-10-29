import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MediaCarousel from './MediaCarousel';
import type { MediaItem } from '../../types';

const images = (n: number, prefix: string): MediaItem[] =>
  Array.from({ length: n }, (_, i) => ({ type: 'image', url: `/media/projects/${prefix}/${i + 1}.webp` }));

describe('MediaCarousel', () => {
  it('stays in range when the gallery shrinks (third image selected, then a one-image project)', () => {
    const { rerender } = render(<MediaCarousel media={images(3, 'a')} title="Alpha" />);
    fireEvent.click(screen.getByRole('button', { name: /Alpha screenshot 3/ }));
    rerender(<MediaCarousel media={images(1, 'b')} title="Beta" />);
    expect(screen.getByRole('img', { name: 'Beta screenshot 1' }).getAttribute('src')).toBe('/media/projects/b/1.webp');
  });

  it('names its thumbnails, marks the current one, and supports arrow keys', () => {
    render(<MediaCarousel media={images(3, 'a')} title="Alpha" />);
    const thumbs = screen.getAllByRole('button', { name: /^Show / });
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].getAttribute('aria-current')).toBe('true');
    fireEvent.keyDown(screen.getByRole('region', { name: 'Alpha gallery' }), { key: 'ArrowLeft' });
    expect(screen.getAllByRole('button', { name: /^Show / })[2].getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('img', { name: 'Alpha screenshot 3' })).toBeTruthy();
  });

  it('offers smaller sizes for uploaded WebP images', () => {
    render(<MediaCarousel media={images(1, 'a')} title="Alpha" />);
    expect(screen.getByRole('img').getAttribute('srcset')).toBe(
      '/media/projects/a/1.w640.webp 640w, /media/projects/a/1.w1280.webp 1280w, /media/projects/a/1.webp 2560w',
    );
  });
});
