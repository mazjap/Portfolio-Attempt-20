function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    return ((h >>> 0) / 0xffffffff);
  };
}

interface Props {
  seed: string;
  rows?: number;
  className?: string;
}

export default function Minimap({ seed, rows = 28, className = '' }: Props) {
  const rand = seededRandom(seed);
  const lines = Array.from({ length: rows }, () => {
    const indent = Math.floor(rand() * 3);
    const width = 0.3 + rand() * 0.55;
    const opacity = 0.15 + rand() * 0.45;
    const isBlank = rand() > 0.82;
    return { indent, width, opacity, isBlank };
  });

  return (
    <div className={`flex flex-col gap-[3px] py-1 ${className}`} aria-hidden>
      {lines.map((line, i) =>
        line.isBlank ? (
          <div key={i} className="h-[3px]" />
        ) : (
          <div
            key={i}
            className="h-[3px] rounded-full bg-xcode-accent dark:bg-xcode-accent"
            style={{
              marginLeft: `${line.indent * 8}px`,
              width: `${line.width * 100}%`,
              opacity: line.opacity,
            }}
          />
        )
      )}
    </div>
  );
}
