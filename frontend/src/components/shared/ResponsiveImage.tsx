import type { ImgHTMLAttributes } from 'react';
import { mediaSrcSet } from '../../lib/media';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string;
  /** How wide the image is displayed, so the browser can pick a size (like "(min-width: 1024px) 320px, 100vw"). */
  sizes: string;
}

/**
 * An image that lets the browser choose a smaller stored size, and lazy-loads by default (pass
 * `loading="eager"` for images visible on first paint). If a smaller size is missing, it drops the
 * `srcset` and loads `src` instead.
 */
export default function ResponsiveImage({ src, sizes, loading = 'lazy', onError, ...rest }: Props) {
  const srcSet = mediaSrcSet(src);
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      loading={loading}
      decoding="async"
      onError={e => {
        if (e.currentTarget.hasAttribute('srcset')) e.currentTarget.removeAttribute('srcset');
        else onError?.(e);
      }}
      {...rest}
    />
  );
}
