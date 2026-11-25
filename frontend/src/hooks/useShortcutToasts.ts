import { useEffect, useState } from 'react';
import { createKonamiDetector, isTypingTarget, matchShortcut, type ShortcutId } from '../lib/shortcuts';

export interface Toast {
  text: string;
  /** Text color class. */
  cls: string;
  /** Show the clock time next to the text (Build Succeeded does). */
  time?: boolean;
}

/** One frame of a toast, shown for `ms` before the next frame (or before it disappears). */
type Step = Toast & { ms: number };

const SEQUENCES: Record<ShortcutId | 'konami', Step[]> = {
  build: [
    { text: '⟳  Building…', cls: 'text-xcode-yellow', ms: 900 },
    { text: '✓  Build Succeeded', cls: 'text-xcode-green', time: true, ms: 2600 },
  ],
  clean: [
    { text: 'Clean Build Folder…', cls: 'text-xcode-muted', ms: 700 },
    { text: 'Clean Build Folder… Done.', cls: 'text-xcode-muted', ms: 1800 },
  ],
  jump: [{ text: 'Jump to Definition: you are already here.', cls: 'text-xcode-muted', ms: 2800 }],
  continue: [
    { text: '▶  Continuing…', cls: 'text-xcode-yellow', ms: 600 },
    { text: 'Program ended with exit code: 0', cls: 'text-xcode-muted', ms: 2400 },
  ],
  konami: [{ text: '★  Achievement unlocked: Konami Code', cls: 'text-xcode-green', ms: 3200 }],
};

/**
 * Listens for the site's keyboard shortcuts and the Konami code, and returns the toast to show, if any.
 * ⌘R isn't intercepted (browsers use it to reload, and reloading is how people recover from problems).
 * Shortcuts are ignored while typing, and never move focus or scroll the page.
 */
export function useShortcutToasts(): Toast | null {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let timers: number[] = [];
    const konami = createKonamiDetector();

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function play(steps: Step[]) {
      clearTimers();
      let at = 0;
      steps.forEach((step, i) => {
        const show = () => setToast({ text: step.text, cls: step.cls, time: step.time });
        if (i === 0) show();
        else timers.push(window.setTimeout(show, at));
        at += step.ms;
      });
      timers.push(window.setTimeout(() => setToast(null), at));
    }

    function handler(e: KeyboardEvent) {
      if (e.isComposing || isTypingTarget(e.target)) {
        konami.reset();
        return;
      }
      const shortcut = matchShortcut(e);
      if (shortcut) {
        konami.reset();
        e.preventDefault();
        if (!e.repeat) play(SEQUENCES[shortcut]);
        return;
      }
      if (konami.press(e)) play(SEQUENCES.konami);
    }

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimers();
    };
  }, []);

  return toast;
}
