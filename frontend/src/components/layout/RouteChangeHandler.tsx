import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Single-page navigation doesn't reset the page like a real one, so on each new path: scroll to the
 * top (or to the #fragment), and move focus to the main content so keyboard and screen reader users
 * start at the new page instead of wherever the link was. Tag-filter changes (?tag=) don't count.
 */
export default function RouteChangeHandler({ mainId }: { mainId: string }) {
  const { pathname, hash } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    document.getElementById(mainId)?.focus({ preventScroll: true });
  }, [pathname, hash, mainId]);

  return null;
}
