import { useSyncExternalStore } from 'react';

// Tailwind's `xl` breakpoint. The scroll minimap only shows from here up.
const XL = '(min-width: 1280px)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(XL);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const isXl = () => window.matchMedia(XL).matches;

/** Whether the window is at least 1280 px wide (Tailwind's `xl`), kept up to date as it is resized. */
export function useIsXl(): boolean {
  return useSyncExternalStore(subscribe, isXl, () => false);
}
