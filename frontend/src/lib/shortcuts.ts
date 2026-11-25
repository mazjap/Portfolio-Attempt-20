/**
 * The site's Xcode-style keyboard shortcuts (Mac only: they need ⌘).
 *
 * Browsers own most shortcuts, so each key was compared against the shortcut lists of Chrome,
 * Safari, and Firefox on macOS, and the same letters on Windows and Linux. That comparison is from
 * documentation and memory, not tried by hand in each browser (see "November 25 batch" in TASKS.md
 * for the by-hand check).
 * - ⌘B and ⌘⇧K are the originals. (Firefox uses ⌘B for its bookmarks sidebar; the site wins there
 *   only while the page has focus and nothing is being typed.)
 * - ⌃⌘J (Jump to Definition) and ⌃⌘Y (Continue) combine Control and Command, which no browser
 *   binds to a letter that I know of. Plain ⌘J and ⌘Y are Downloads and History, so they're
 *   deliberately left alone.
 * - macOS itself: the system-wide ⌃⌘ shortcuts I know of are ⌃⌘F (full screen), ⌃⌘Q (lock screen),
 *   ⌃⌘D (Look Up), and ⌃⌘Space (emoji), and none is J or Y. Verified on one Mac (2026-11-25) by
 *   reading its Keyboard Shortcuts settings (`com.apple.symbolichotkeys`): the only ⌃⌘ entries
 *   there are the ⌃⌘⇧3/4/6 screenshot ones, and nothing is bound to J or Y. The hard-coded ones
 *   above aren't in that file, so they come from documentation, not from the check.
 * - Not used, because a browser has them: ⌘R, ⌘U (Firefox view-source), ⌘. (Safari stop),
 *   ⌘⇧O (bookmarks), ⌘⇧Y (downloads), ⌘⇧B (bookmarks bar), ⌘K, ⌘0.
 * Matching is exact about modifiers, so ⌘⌥B or ⌃⌘B never fire the ⌘B toast.
 */
export type ShortcutId = 'build' | 'clean' | 'jump' | 'continue';

export interface ShortcutInfo {
  id: ShortcutId;
  keys: string;
  name: string;
}

/** Listed by the console's `shortcuts` command. */
export const SHORTCUTS: ShortcutInfo[] = [
  { id: 'build', keys: '⌘B', name: 'Build' },
  { id: 'clean', keys: '⌘⇧K', name: 'Clean Build Folder' },
  { id: 'jump', keys: '⌃⌘J', name: 'Jump to Definition' },
  { id: 'continue', keys: '⌃⌘Y', name: 'Continue' },
];

/** Whether a key event came from somewhere text is entered, where shortcuts must stay out of the way. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null;
}

/** Which shortcut a key event is, or null. Doesn't look at the event target; see `isTypingTarget`. */
export function matchShortcut(e: KeyboardEvent): ShortcutId | null {
  if (!e.metaKey || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (!e.ctrlKey) {
    if (!e.shiftKey && key === 'b') return 'build';
    if (e.shiftKey && key === 'k') return 'clean';
    return null;
  }
  if (!e.shiftKey) {
    if (key === 'j') return 'jump';
    if (key === 'y') return 'continue';
  }
  return null;
}

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const MODIFIER_KEYS = new Set(['shift', 'control', 'alt', 'meta', 'capslock', 'altgraph', 'os']);

/**
 * Feeds key presses to the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) and says when it's complete. Presses with ⌘, Ctrl, or
 * Alt held reset it, bare modifier keys are skipped (so a held Shift doesn't break the sequence), and
 * auto-repeat is ignored.
 */
export function createKonamiDetector(): { press(e: KeyboardEvent): boolean; reset(): void } {
  let recent: string[] = [];
  return {
    press(e) {
      const key = e.key.toLowerCase();
      if (MODIFIER_KEYS.has(key) || e.repeat) return false;
      if (e.metaKey || e.ctrlKey || e.altKey) {
        recent = [];
        return false;
      }
      recent = [...recent, key].slice(-KONAMI.length);
      if (recent.length === KONAMI.length && recent.every((k, i) => k === KONAMI[i])) {
        recent = [];
        return true;
      }
      return false;
    },
    reset() {
      recent = [];
    },
  };
}
