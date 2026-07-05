import { useState, useEffect, useRef, useCallback } from 'react';

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    return (h >>> 0) / 0xffffffff;
  };
}

interface ContentEl {
  type: 'heading' | 'image' | 'code';
  absTop: number;
  height: number;
  level?: number;
}

interface Props {
  contentRef?: React.RefObject<HTMLElement | null>;
  seed: string;
  rows?: number;
}

export default function ScrollMinimap({ contentRef, seed, rows = 180 }: Props) {
  const [scrollY, setScrollY] = useState(0);
  const [totalH, setTotalH] = useState(1);
  const [viewH, setViewH] = useState(1);
  const [containerH, setContainerH] = useState(() => Math.max(window.innerHeight - 48, 1));
  const [elements, setElements] = useState<ContentEl[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track window scroll & document height
  useEffect(() => {
    function update() {
      setScrollY(window.scrollY);
      setTotalH(document.documentElement.scrollHeight);
      setViewH(window.innerHeight);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Track own height for scale calculation
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      setContainerH(Math.max(containerRef.current?.clientHeight ?? window.innerHeight - 48, 1));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Scan content for semantic elements to render accurately
  useEffect(() => {
    if (!contentRef?.current) return;

    function scan() {
      const root = contentRef!.current!;
      const nodes = root.querySelectorAll('h1, h2, h3, h4, img, pre, figure');
      const found: ContentEl[] = [];
      nodes.forEach(node => {
        const el = node as HTMLElement;
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        const height = el.offsetHeight || rect.height;
        if (height < 1) return;
        const tag = node.tagName;
        const m = /^H(\d)$/.exec(tag);
        found.push({
          type: m ? 'heading' : (tag === 'IMG' || tag === 'FIGURE') ? 'image' : 'code',
          absTop,
          height: Math.max(height, 3),
          level: m ? parseInt(m[1]) : undefined,
        });
      });
      setElements(found);
    }

    scan();
    const ro = new ResizeObserver(scan);
    ro.observe(contentRef.current!);
    return () => ro.disconnect();
  }, [contentRef]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientY - rect.top) / rect.height;
    window.scrollTo({ top: ratio * (document.documentElement.scrollHeight - window.innerHeight), behavior: 'smooth' });
  }, []);

  // Background seeded bars
  const rand = seededRandom(seed);
  const bgBars = Array.from({ length: rows }, () => {
    const indent = Math.floor(rand() * 4);
    const width = 0.25 + rand() * 0.6;
    const opacity = 0.12 + rand() * 0.28;
    const isBlank = rand() > 0.8;
    return { indent, width, opacity, isBlank };
  });

  const scale = containerH / totalH;
  const highlightTopPct = (scrollY / totalH) * 100;
  const highlightHeightPct = Math.min((viewH / totalH) * 100, 100);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      aria-hidden
      className="relative hidden xl:block w-14 flex-shrink-0 sticky top-12 self-start h-[calc(100vh-3rem)] cursor-pointer border-l border-xcode-border-light dark:border-xcode-border bg-xcode-bg-light/50 dark:bg-xcode-bg/50 overflow-hidden select-none"
    >
      {/* Background seeded bars */}
      <div className="absolute inset-0 flex flex-col gap-[2.5px] px-1 pt-1 pointer-events-none">
        {bgBars.map((bar, i) =>
          bar.isBlank ? (
            <div key={i} className="h-[2.5px] flex-shrink-0" />
          ) : (
            <div
              key={i}
              className="h-[2.5px] rounded-full bg-xcode-accent flex-shrink-0"
              style={{
                marginLeft: `${bar.indent * 6}%`,
                width: `${bar.width * (100 - bar.indent * 6)}%`,
                opacity: bar.opacity,
              }}
            />
          )
        )}
      </div>

      {/* Semantic content overlays */}
      {elements.map((el, i) => {
        const top = el.absTop * scale;
        const h = Math.max(el.height * scale, 1.5);
        if (el.type === 'heading') {
          const w = el.level === 1 ? '82%' : el.level === 2 ? '66%' : '52%';
          return (
            <div
              key={i}
              className="absolute rounded-sm pointer-events-none"
              style={{ top, height: Math.max(h, 2.5), left: 3, width: w, background: 'rgba(78,184,250,0.75)' }}
            />
          );
        }
        if (el.type === 'image') {
          return (
            <div
              key={i}
              className="absolute pointer-events-none rounded-sm"
              style={{ top, height: Math.max(h, 6), left: 3, right: 3, background: 'rgba(142,142,147,0.25)', border: '1px solid rgba(142,142,147,0.35)' }}
            />
          );
        }
        // code block
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{ top, height: Math.max(h, 4), left: 3, right: 3, background: 'rgba(78,184,250,0.07)', borderLeft: '2px solid rgba(78,184,250,0.45)' }}
          />
        );
      })}

      {/* Viewport highlight */}
      <div
        className="absolute inset-x-0 pointer-events-none z-10 transition-[top,height] duration-75"
        style={{
          top: `${highlightTopPct}%`,
          height: `${highlightHeightPct}%`,
          background: 'rgba(78,184,250,0.08)',
          borderTop: '1px solid rgba(78,184,250,0.35)',
          borderBottom: '1px solid rgba(78,184,250,0.35)',
        }}
      />
    </div>
  );
}
