import { useState, type KeyboardEvent } from 'react';
import ResponsiveImage from '../shared/ResponsiveImage';
import type { MediaItem } from '../../types';

interface Props {
  media: MediaItem[];
  title: string;
}

const arrowCls =
  'absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

export default function MediaCarousel({ media, title }: Props) {
  const [selected, setSelected] = useState(0);

  if (!media.length) return null;

  // Keep the selection in range if the list shrinks (ProjectDetail also remounts this per project).
  const index = Math.min(selected, media.length - 1);
  const current = media[index];
  const count = media.length;
  const describe = (item: MediaItem, i: number) => item.caption || `${title} ${item.type === 'video' ? 'video' : 'screenshot'} ${i + 1}`;
  const show = (i: number) => setSelected((i + count) % count);

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (count < 2) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      show(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      show(index + 1);
    }
  }

  return (
    <div className="space-y-2" role="region" aria-roledescription="carousel" aria-label={`${title} gallery`} onKeyDown={handleKey}>
      <div className="relative rounded-xl overflow-hidden bg-xcode-surface-light dark:bg-xcode-surface aspect-video">
        {current.type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            aria-label={describe(current, index)}
            className="w-full h-full object-contain"
          />
        ) : (
          <ResponsiveImage
            key={current.url}
            src={current.url}
            sizes="(min-width: 768px) 672px, 100vw"
            loading="eager"
            alt={describe(current, index)}
            className="w-full h-full object-contain"
          />
        )}

        {count > 1 && (
          <>
            <button type="button" onClick={() => show(index - 1)} className={`${arrowCls} left-2`} aria-label="Previous image">
              ‹
            </button>
            <button type="button" onClick={() => show(index + 1)} className={`${arrowCls} right-2`} aria-label="Next image">
              ›
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <>
          <p className="sr-only" aria-live="polite">
            Image {index + 1} of {count}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.map((item, i) => (
              <button
                type="button"
                key={`${item.url}-${i}`}
                onClick={() => show(i)}
                aria-label={`Show ${describe(item, i)} (${i + 1} of ${count})`}
                aria-current={i === index ? 'true' : undefined}
                className={`flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcode-accent ${
                  i === index ? 'border-xcode-accent' : 'border-transparent opacity-50 hover:opacity-75'
                }`}
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full bg-xcode-surface-light dark:bg-xcode-surface flex items-center justify-center text-xcode-muted text-xs" aria-hidden>
                    ▶
                  </div>
                ) : (
                  <ResponsiveImage src={item.url} sizes="64px" alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
