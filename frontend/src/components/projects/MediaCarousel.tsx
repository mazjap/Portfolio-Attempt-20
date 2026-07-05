import { useState } from 'react';
import type { MediaItem } from '../../types';

interface Props {
  media: MediaItem[];
  title: string;
}

export default function MediaCarousel({ media, title }: Props) {
  const [index, setIndex] = useState(0);

  if (!media.length) return null;

  const current = media[index];

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden bg-xcode-surface-light dark:bg-xcode-surface aspect-video">
        {current.type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            className="w-full h-full object-contain"
          />
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt={current.caption ?? `${title} screenshot ${index + 1}`}
            className="w-full h-full object-contain"
          />
        )}

        {media.length > 1 && (
          <>
            <button
              onClick={() => setIndex(i => (i - 1 + media.length) % media.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              onClick={() => setIndex(i => (i + 1) % media.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}
      </div>

      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {media.map((item, i) => (
            <button
              key={item.url}
              onClick={() => setIndex(i)}
              className={`flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-colors ${
                i === index ? 'border-xcode-accent' : 'border-transparent opacity-50 hover:opacity-75'
              }`}
            >
              {item.type === 'video' ? (
                <div className="w-full h-full bg-xcode-surface-light dark:bg-xcode-surface flex items-center justify-center text-xcode-muted text-xs">
                  ▶
                </div>
              ) : (
                <img src={item.url} alt={item.caption ?? ''} className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
