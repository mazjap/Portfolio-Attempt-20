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
