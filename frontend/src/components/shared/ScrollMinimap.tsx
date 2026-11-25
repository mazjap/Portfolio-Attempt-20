import { useState, useEffect, useRef, useCallback, memo, Fragment } from 'react';
import { useIsXl } from '../../hooks/useIsXl';
import { prefersReducedMotion } from '../../lib/motion';
import {
  grabOffset,
  indicatorRect,
  minimapScale,
  sampleEvenly,
  scanBlocks,
  scrollTopForClick,
  scrollTopForDrag,
  type ContentEl,
  type MinimapSize,
} from '../../lib/minimap';

interface Props {
  contentRef: React.RefObject<HTMLElement | null>;
  /**
   * Identifies the content being shown (like the project ID), or null while nothing is shown. The DOM
   * is rescanned whenever it changes, even if the new article happens to be the same height.
   */
  contentKey: string | null;
}

const HEADING_WIDTHS = ['80%', '65%', '52%', '42%'];
/** Heading text size in the minimap, by level. Tiny, but a texture you can read the shape of. */
const HEADING_FONT_PX = [7, 6, 5.5, 5];
const LINE_STRIDE = 4; // 2px bar + 2px gap
/** Where a heading lands below the top of the window when the minimap jumps to it (clear of the navbar). */
const JUMP_MARGIN = 64;
/** How far (in page pixels) a bar can differ between scans and still be the same bar: positions are
 * fractional, and a rescan at another scroll position can differ by rounding alone. */
const SAME_BAR_TOLERANCE = 1;

interface BarsProps {
  elements: ContentEl[];
  scale: number;
  /** The bar the mouse is over, or null when it leaves. */
  onHover: (el: ContentEl | null) => void;
  onJump: (el: ContentEl) => void;
}

/**
 * The content bars. Memoized, so scrolling only re-renders the viewport indicator (keep `onHover` and
 * `onJump` stable). Headings and images are the interactive ones: they react to hover and jump to
 * their place in the page when clicked. Everything else stays `pointer-events-none`, so a click on it
 * falls through to the minimap's own click-to-scroll.
 */
const Bars = memo(function Bars({ elements, scale, onHover, onJump }: BarsProps) {
  // How much room each heading has before the next one starts, so its text is only drawn if it fits.
  const roomBelow: number[] = [];
  let nextHeadingTop = Infinity;
  for (let i = elements.length - 1; i >= 0; i--) {
    roomBelow[i] = (nextHeadingTop - elements[i].absTop) * scale;
    if (elements[i].type === 'heading') nextHeadingTop = elements[i].absTop;
  }

  const interactive = (el: ContentEl) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') onHover(el);
    },
    onPointerLeave: () => onHover(null),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation(); // not the minimap's own jump
      onJump(el);
    },
  });

  return (
    <>
      {elements.map((el, i) => {
        const top = el.absTop * scale;
        const h = Math.max(el.height * scale, 1.5);

        if (el.type === 'heading') {
          const level = el.level ?? 1;
          const font = HEADING_FONT_PX[level - 1] ?? 5;
          const chipH = font + 2;
          if (el.text && roomBelow[i] >= chipH) {
            // The heading's own words, on a patch that hides the lines it overlaps.
            return (
              <div
                key={i}
                data-minimap-heading
                {...interactive(el)}
                className="absolute left-[3px] max-w-[calc(100%-6px)] overflow-hidden whitespace-nowrap text-ellipsis rounded-sm px-[2px] font-semibold leading-none cursor-pointer pointer-events-auto bg-xcode-bg-light dark:bg-xcode-bg text-xcode-accent motion-safe:transition-colors hover:bg-xcode-accent hover:text-xcode-bg-light dark:hover:text-xcode-bg"
                style={{ top: Math.max(top + h / 2 - chipH / 2, 0), height: chipH, lineHeight: `${chipH}px`, fontSize: font }}
              >
                {el.text}
              </div>
            );
          }
          // Too close to the next heading for text: a bar, like a line of the heading.
          return (
            <div
              key={i}
              data-minimap-heading
              {...interactive(el)}
              className="absolute rounded-sm cursor-pointer pointer-events-auto motion-safe:transition-opacity opacity-80 hover:opacity-100"
              style={{ top, height: Math.max(h, 3), left: 3, width: HEADING_WIDTHS[level - 1] ?? '52%', background: 'rgba(78,184,250,0.8)' }}
            />
          );
        }

        if (el.type === 'image') {
          return (
            <div
              key={i}
              data-minimap-image
              {...interactive(el)}
              className="absolute overflow-hidden rounded-sm cursor-pointer pointer-events-auto motion-safe:transition-shadow hover:ring-1 hover:ring-xcode-accent"
              style={{ top, height: Math.max(h, 6), left: 3, right: 3, background: 'rgba(142,142,147,0.22)', border: '1px solid rgba(142,142,147,0.35)' }}
            >
              {el.thumb && <img src={el.thumb} alt="" draggable={false} decoding="async" className="block h-full w-full object-cover" />}
            </div>
          );
        }

        if (el.type === 'code') {
          // One mark per line of code (sampled if there are more than fit), in the block's padding.
          const pad = Math.min(16 * scale, h * 0.2);
          const inner = Math.max(h - pad * 2, 0);
          const lines = sampleEvenly(el.lines ?? [], Math.floor(inner / 1.6));
          const stride = lines.length ? inner / lines.length : 0;
          const thickness = Math.min(Math.max(stride * 0.55, 0.75), 2.5);
          return (
            <div
              key={i}
              data-minimap-code
              className="absolute pointer-events-none"
              style={{ top, height: Math.max(h, 4), left: 3, right: 3, background: 'rgba(78,184,250,0.07)', borderLeft: '2px solid rgba(78,184,250,0.45)' }}
            >
              {lines.map((line, li) =>
                line.width > 0 ? (
                  <div
                    key={li}
                    className="absolute rounded-full"
                    style={{
                      top: pad + li * stride + (stride - thickness) / 2,
                      height: thickness,
                      left: `${1 + line.left * 96}%`,
                      width: `${Math.max(line.width * 96, 4)}%`,
                      background: line.comment ? 'rgb(var(--xcode-green) / 0.6)' : 'rgb(var(--xcode-accent) / 0.55)',
                    }}
                  />
                ) : null,
              )}
            </div>
          );
        }

        if (el.type === 'blockquote') {
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{ top, height: Math.max(h, 4), left: 3, right: 3, background: 'rgba(160,160,165,0.08)', borderLeft: '2px solid rgba(160,160,165,0.45)' }}
            />
          );
        }

        if (el.type === 'hr') {
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{ top, height: 1, left: 3, right: 3, background: 'rgba(160,160,165,0.35)' }}
            />
          );
        }

        if (el.type === 'table') {
          // rows of alternating fills to suggest a grid
          const rowH = 3;
          const rowGap = 1.5;
          const stride = rowH + rowGap;
          const numRows = Math.max(Math.floor(h / stride), 1);
          return (
            <Fragment key={i}>
              {Array.from({ length: numRows }, (_, ri) => (
                <div
                  key={ri}
                  className="absolute pointer-events-none rounded-sm"
                  style={{
                    top: top + ri * stride,
                    height: rowH,
                    left: 3,
                    right: 3,
                    background: ri === 0
                      ? 'rgba(78,184,250,0.25)'       // header row
                      : ri % 2 === 0
                        ? 'rgba(160,160,165,0.12)'    // even row
                        : 'rgba(160,160,165,0.06)',   // odd row
                  }}
                />
              ))}
            </Fragment>
          );
        }

        // paragraph / list — render as simulated text lines
        const numLines = Math.max(Math.floor(h / LINE_STRIDE), 1);
        const left = el.type === 'list' ? 7 : 3;

        return (
          <Fragment key={i}>
            {Array.from({ length: numLines }, (_, li) => {
              const isLast = li === numLines - 1;
              const variation = (el.absTop + li * 13) % 28;
              const widthPct = isLast ? 30 + variation : 58 + variation;
              return (
                <div
                  key={li}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    top: top + li * LINE_STRIDE,
                    height: 2,
                    left,
                    width: `${widthPct}%`,
                    background: 'rgba(160,160,165,0.32)',
                  }}
                />
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
});

export default function ScrollMinimap({ contentRef, contentKey }: Props) {
  // The minimap only shows at xl (1280px) and up; below that it does no work at all.
  const visible = useIsXl();
  const [scrollY, setScrollY] = useState(0);
  const [totalH, setTotalH] = useState(1);
  const [viewH, setViewH] = useState(1);
  const [containerH, setContainerH] = useState(() => Math.max(window.innerHeight - 48, 1));
  const [elements, setElements] = useState<ContentEl[]>([]);
  // The bar the mouse is over, by what it is and where, not by its place in `elements`: a rescan can
  // insert or reorder elements (an image loading above), and the preview must not switch to another.
  const [hovered, setHovered] = useState<Pick<ContentEl, 'type' | 'absTop'> | null>(null);
  const hover = useCallback((el: ContentEl | null) => setHovered(el && { type: el.type, absTop: el.absTop }), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll and resize, at most once per frame.
  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    function update() {
      setScrollY(window.scrollY);
      setTotalH(document.documentElement.scrollHeight);
      setViewH(window.innerHeight);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    }
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !containerRef.current) return;
    const ro = new ResizeObserver(() => {
      setContainerH(Math.max(containerRef.current?.clientHeight ?? window.innerHeight - 48, 1));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [visible]);

  // Rescan when the content changes (contentKey), and whenever the article resizes (images load,
  // code blocks wrap). The document height is re-measured with each scan, since content that loads
  // after the first render changes it. An image finishing loading doesn't always resize the article
  // (the 4:3 box it reserved may already be right), but it does give the minimap its thumbnail.
  useEffect(() => {
    const root = contentRef.current;
    if (!visible || !root || contentKey === null) return;

    function scan() {
      const found = scanBlocks(root!);
      setElements(found);
      setTotalH(document.documentElement.scrollHeight);
      setViewH(window.innerHeight);
    }

    let frame = 0;
    function scanSoon() {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    }

    scan();
    const ro = new ResizeObserver(scan);
    ro.observe(root);
    // `load` and `error` don't bubble, so listen while they go down.
    root.addEventListener('load', scanSoon, true);
    root.addEventListener('error', scanSoon, true);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      root.removeEventListener('load', scanSoon, true);
      root.removeEventListener('error', scanSoon, true);
    };
  }, [contentRef, contentKey, visible]);

  // The size of everything right now, read from the page rather than from state, so a click or drag
  // always uses what is on screen.
  const measure = useCallback((): { top: number; size: MinimapSize } | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      top: rect.top,
      size: { totalH: document.documentElement.scrollHeight, viewH: window.innerHeight, containerH: rect.height },
    };
  }, []);

  // Clicking the minimap centers the viewport on that point (smoothly, unless motion is reduced).
  // A press on the indicator is the start of a drag, and its click is not a jump.
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('[data-minimap-indicator]')) return;
    const m = measure();
    if (!m) return;
    window.scrollTo({
      top: scrollTopForClick(e.clientY - m.top, m.size),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [measure]);

  // A click on a heading or an image bar goes to that heading or image, at the top of the window.
  const jumpTo = useCallback((el: ContentEl) => {
    window.scrollTo({ top: Math.max(el.absTop - JUMP_MARGIN, 0), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, []);

  // Dragging the indicator works like a scrollbar thumb: the point you grabbed stays under the pointer.
  const drag = useRef<{ pointerId: number; grab: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const startDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    const m = measure();
    if (!m) return;
    e.preventDefault(); // no text selection, no focus change
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; the drag will end on its own.
    }
    drag.current = { pointerId: e.pointerId, grab: grabOffset(e.clientY - m.top, window.scrollY, m.size) };
    setDragging(true);
    setHovered(null);
  }, [measure]);

  const moveDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const m = measure();
    if (!d || !m || e.pointerId !== d.pointerId) return;
    const top = scrollTopForDrag(e.clientY - m.top, d.grab, m.size);
    // Instant, so the page follows the pointer. The indicator is moved now rather than waiting for
    // the scroll event.
    window.scrollTo({ top, behavior: 'instant' });
    setScrollY(top);
  }, [measure]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  }, []);

  const size: MinimapSize = { totalH, viewH, containerH };
  const scale = minimapScale(size);
  const indicator = indicatorRect(scrollY, size);
  // If the bar moved or went away in a rescan, there is no preview until the mouse reaches one again.
  const preview = hovered && !dragging ? elements.find(el => el.type === hovered.type && Math.abs(el.absTop - hovered.absTop) < SAME_BAR_TOLERANCE) : undefined;

  return (
    <div
      aria-hidden
      className="relative hidden xl:block w-14 flex-shrink-0 sticky top-12 z-20 self-start h-[calc(100vh-3rem)] border-l border-xcode-border-light dark:border-xcode-border bg-xcode-bg-light/50 dark:bg-xcode-bg/50"
    >
      {/* The track clips the bars; the hover preview sits outside it, beside the minimap. */}
      <div
        ref={containerRef}
        data-minimap-track
        onClick={handleClick}
        className="absolute inset-0 cursor-pointer overflow-hidden select-none"
      >
        {visible && contentKey !== null && <Bars elements={elements} scale={scale} onHover={hover} onJump={jumpTo} />}

        {/* Viewport indicator: drag it like a scrollbar thumb. */}
        <div
          data-minimap-indicator
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          className={`absolute inset-x-0 z-10 touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab transition-[top,height] duration-75'}`}
          style={{
            top: indicator.top,
            height: indicator.height,
            background: 'rgba(78,184,250,0.08)',
            borderTop: '1px solid rgba(78,184,250,0.35)',
            borderBottom: '1px solid rgba(78,184,250,0.35)',
          }}
        />
      </div>

      {visible && preview && <Preview el={preview} top={(preview.absTop + preview.height / 2) * scale} containerH={containerH} />}
    </div>
  );
}

/** A larger look at the heading or image under the mouse, to the left of the minimap. */
function Preview({ el, top, containerH }: { el: ContentEl; top: number; containerH: number }) {
  if (el.type === 'heading' && el.text) {
    return (
      <div
        data-minimap-preview
        className="pointer-events-none absolute right-full mr-2 w-max max-w-[260px] rounded-md border border-xcode-border-light dark:border-xcode-border bg-xcode-surface-light dark:bg-xcode-surface px-2.5 py-1.5 text-xs leading-snug text-xcode-text-light dark:text-xcode-text shadow-lg motion-safe:animate-fade-in"
        style={{ top: Math.min(Math.max(top, 16), containerH - 16), transform: 'translateY(-50%)' }}
      >
        <span className="mr-1.5 font-mono text-[10px] uppercase text-xcode-muted">h{el.level}</span>
        {el.text}
      </div>
    );
  }
  if (el.type === 'image' && el.thumb) {
    return (
      <div
        data-minimap-preview
        className="pointer-events-none absolute right-full mr-2 w-48 rounded-md border border-xcode-border-light dark:border-xcode-border bg-xcode-surface-light dark:bg-xcode-surface p-1 shadow-lg motion-safe:animate-fade-in"
        style={{ top: Math.min(Math.max(top, 96), containerH - 96), transform: 'translateY(-50%)' }}
      >
        <img src={el.thumb} alt="" draggable={false} className="block max-h-36 w-full rounded object-cover" />
        {el.alt && <p className="mt-1 line-clamp-2 px-0.5 text-[11px] leading-snug text-xcode-muted">{el.alt}</p>}
      </div>
    );
  }
  return null;
}
