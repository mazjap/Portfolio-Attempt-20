/** Whether the visitor asked the OS to reduce motion (smooth scrolling, typing effects, and so on). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
