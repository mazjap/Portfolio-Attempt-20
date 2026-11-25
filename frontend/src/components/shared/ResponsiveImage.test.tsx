import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ResponsiveImage from './ResponsiveImage';

describe('ResponsiveImage', () => {
  it('lazy-loads unless told otherwise', () => {
    const { container, rerender } = render(<ResponsiveImage src="/media/a.webp" sizes="100vw" alt="" />);
    expect(container.querySelector('img')!.getAttribute('loading')).toBe('lazy');
    rerender(<ResponsiveImage src="/media/a.webp" sizes="100vw" alt="" loading="eager" />);
    expect(container.querySelector('img')!.getAttribute('loading')).toBe('eager');
  });
});
