import { useState, useEffect, useRef, useCallback, memo, Fragment } from 'react';
import { useIsXl } from '../../hooks/useIsXl';
import { prefersReducedMotion } from '../../lib/motion';
import { grabOffset, indicatorRect, minimapScale, scrollTopForClick, scrollTopForDrag, type MinimapSize } from '../../lib/minimap';

type ElType = 'heading' | 'paragraph' | 'list' | 'image' | 'code' | 'blockquote' | 'hr' | 'table';

interface ContentEl {
  type: ElType;
  absTop: number;
  height: number;
  level?: number;
}

interface Props {
  contentRef: React.RefObject<HTMLElement | null>;
  /**
   * Identifies the content being shown (like the project ID), or null while nothing is shown. The DOM
   * is rescanned whenever it changes, even if the new article happens to be the same height.
   */
  contentKey: string | null;
}

// Block-level elements we scan
const SCAN_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'P', 'UL', 'OL', 'PRE', 'IMG', 'FIGURE', 'BLOCKQUOTE', 'HR', 'TABLE']);

function hasScannedAncestor(el: Element, root: Element): boolean {
  let parent = el.parentElement;
  while (parent && parent !== root) {
    if (SCAN_TAGS.has(parent.tagName)) return true;
    parent = parent.parentElement;
  }
  return false;
}

const HEADING_WIDTHS = ['80%', '65%', '52%', '42%'];
const LINE_STRIDE = 4; // 2px bar + 2px gap

function scanBlocks(root: HTMLElement): ContentEl[] {
  const found: ContentEl[] = [];
  root.querySelectorAll('h1, h2, h3, h4, p, ul, ol, pre, img, figure, blockquote, hr, table').forEach(node => {
    const tag = node.tagName;
    if (hasScannedAncestor(node, root)) return;

    const el = node as HTMLElement;
    const rect = el.getBoundingClientRect();
    const absTop = rect.top + window.scrollY;
    const height = tag === 'HR' ? 1 : (el.offsetHeight || rect.height);
    if (height < 1 && tag !== 'HR') return;

    const hMatch = /^H(\d)$/.exec(tag);
    let type: ElType;
    if (hMatch) type = 'heading';
    else if (tag === 'P') type = 'paragraph';
    else if (tag === 'UL' || tag === 'OL') type = 'list';
    else if (tag === 'IMG' || tag === 'FIGURE') type = 'image';
    else if (tag === 'PRE') type = 'code';
    else if (tag === 'BLOCKQUOTE') type = 'blockquote';
    else if (tag === 'HR') type = 'hr';
    else if (tag === 'TABLE') type = 'table';
    else return; // unknown block — skip

    found.push({
      type,
      absTop,
      height: Math.max(height, tag === 'HR' ? 1 : 3),
      level: hMatch ? parseInt(hMatch[1]) : undefined,
    });
  });
  return found;
}

/** The content bars. Memoized, so scrolling only re-renders the viewport highlight. */
const Bars = memo(function Bars({ elements, scale }: { elements: ContentEl[]; scale: number }) {
  return (
    <>
      {elements.map((el, i) => {
        const top = el.absTop * scale;
        const h = Math.max(el.height * scale, 1.5);

        if (el.type === 'heading') {
          const w = HEADING_WIDTHS[(el.level ?? 1) - 1] ?? '52%';
          return (
            <div
              key={i}
              className="absolute rounded-sm pointer-events-none"
              style={{ top, height: Math.max(h, 3), left: 3, width: w, background: 'rgba(78,184,250,0.8)' }}
            />
          );
        }

        if (el.type === 'image') {
          return (
            <div
              key={i}
              className="absolute pointer-events-none rounded-sm"
              style={{ top, height: Math.max(h, 6), left: 3, right: 3, background: 'rgba(142,142,147,0.22)', border: '1px solid rgba(142,142,147,0.35)' }}
            />
          );
        }

        if (el.type === 'code') {
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{ top, height: Math.max(h, 4), left: 3, right: 3, background: 'rgba(78,184,250,0.07)', borderLeft: '2px solid rgba(78,184,250,0.45)' }}
            />
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
  // after the first render changes it.
  useEffect(() => {
    const root = contentRef.current;
    if (!visible || !root || contentKey === null) return;

    function scan() {
      setElements(scanBlocks(root!));
      setTotalH(document.documentElement.scrollHeight);
      setViewH(window.innerHeight);
    }

    scan();
    const ro = new ResizeObserver(scan);
    ro.observe(root);
    return () => ro.disconnect();
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

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      aria-hidden
      className="relative hidden xl:block w-14 flex-shrink-0 sticky top-12 self-start h-[calc(100vh-3rem)] cursor-pointer border-l border-xcode-border-light dark:border-xcode-border bg-xcode-bg-light/50 dark:bg-xcode-bg/50 overflow-hidden select-none"
    >
      {visible && contentKey !== null && <Bars elements={elements} scale={scale} />}

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
  );
}
