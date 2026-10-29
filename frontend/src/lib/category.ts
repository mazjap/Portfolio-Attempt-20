// The fake file extension each project category gets on cards and detail pages.
export type FileExt = 'ts' | 'swift' | 'phys';

export function getCategoryExtension(category?: string | null): FileExt | null {
  if (!category) return null;
  const cat = category.toLowerCase().trim();
  if (cat === 'web') return 'ts';
  if (/^(ios|macos|watchos|tvos|visionos)\s+app$/.test(cat)) return 'swift';
  if (cat === 'hardware') return 'phys';
  return null;
}

export const EXT_COLORS: Record<FileExt, string> = {
  swift: 'text-xcode-orange',
  ts: 'text-xcode-accent',
  phys: 'text-xcode-green',
};
