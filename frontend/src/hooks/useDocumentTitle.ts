import { useEffect } from 'react';

const SITE_NAME = 'Jordan Christensen';
export const SITE_DESCRIPTION = 'iOS developer, tinkerer, and open-source advocate. Projects, a build-log blog, and app support pages.';

/**
 * Sets the tab title (`<title> · Jordan Christensen`) and the meta description for the current page.
 * `null` leaves them alone (while the page's data is loading). Link previews don't run JavaScript, so
 * they use the share pages the backend writes instead (see DEPLOY.md).
 */
export function useDocumentTitle(title: string | null, description: string = SITE_DESCRIPTION): void {
  useEffect(() => {
    if (title === null) return;
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}
