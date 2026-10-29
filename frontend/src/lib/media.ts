// Uploaded images are stored as `name.webp` (at most 2560 px) with `name.w640.webp` and
// `name.w1280.webp` beside them (see the backend's DEVDOC). Older uploads may not have the smaller
// sizes until `derive-media` runs, so ResponsiveImage falls back to `src` if one fails to load.

const SIZED = /^\/media\/.+\.webp$/;
const DERIVATIVE = /\.w\d+\.webp$/;

/** A `srcset` for an uploaded WebP, or undefined for anything else (external URLs, legacy JPEGs). */
export function mediaSrcSet(url: string | undefined): string | undefined {
  if (!url || !SIZED.test(url) || DERIVATIVE.test(url)) return undefined;
  // Encoded, because srcset splits on whitespace and some older names contain spaces.
  const base = encodeURI(url.slice(0, -'.webp'.length));
  return `${base}.w640.webp 640w, ${base}.w1280.webp 1280w, ${encodeURI(url)} 2560w`;
}
