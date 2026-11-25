import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import ScrollMinimap from './ScrollMinimap';

// An 8000 px page in an 800 px window. The minimap sits under a 48 px navbar and is 752 px tall, so one
// page pixel is 0.094 minimap pixels.
const TOTAL = 8000;
const VIEW = 800;
const MAP_TOP = 48;
const MAP_H = 752;
const SCALE = MAP_H / TOTAL;

let scrollY = 0;
let reducedMotion = false;

beforeEach(() => {
  scrollY = 0;
  reducedMotion = false;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 1280px') || (query.includes('prefers-reduced-motion') && reducedMotion),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW });
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: TOTAL });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const isMap = this.getAttribute('aria-hidden') === 'true';
    const top = isMap ? MAP_TOP : 0;
    const height = isMap ? MAP_H : 0;
    return { top, bottom: top + height, left: 0, right: 56, width: 56, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(window, 'scrollY');
  Reflect.deleteProperty(document.documentElement, 'scrollHeight');
  Reflect.deleteProperty(window, 'innerHeight');
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
  Reflect.deleteProperty(Element.prototype, 'releasePointerCapture');
});

function Page() {
  const ref = useRef<HTMLElement>(null);
  return (
    <>
      <article ref={ref}>
        <p>Some text.</p>
      </article>
      <ScrollMinimap contentRef={ref} contentKey="post" />
    </>
  );
}

function setup(initialScrollY = 1600) {
  scrollY = initialScrollY;
  const { container } = render(<Page />);
  const minimap = container.querySelector<HTMLElement>('[aria-hidden="true"]')!;
  const indicator = container.querySelector<HTMLElement>('[data-minimap-indicator]')!;
  return { minimap, indicator };
}

const scrollTo = () => vi.mocked(window.scrollTo);
const pointer = (clientY: number, init: PointerEventInit = {}) => ({ clientY, pointerId: 1, isPrimary: true, button: 0, ...init });

describe('ScrollMinimap indicator', () => {
  it('shows the viewport at the same scale as the bars', () => {
    const { indicator } = setup(1600);
    expect(parseFloat(indicator.style.top)).toBeCloseTo(1600 * SCALE);
    expect(parseFloat(indicator.style.height)).toBeCloseTo(VIEW * SCALE);
  });

  it('is decorative: hidden from assistive tech and out of the tab order', () => {
    const { minimap } = setup();
    expect(minimap.hasAttribute('tabindex')).toBe(false);
    expect(minimap.querySelector('a, button, input, [tabindex]')).toBeNull();
  });

  it('follows the pointer when dragged, keeping the point that was grabbed', () => {
    const { indicator } = setup(1600);
    const top = 1600 * SCALE; // 150.4
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + top + 20)); // 20 px below its top edge
    expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(1);

    fireEvent.pointerMove(indicator, pointer(MAP_TOP + top + 20 + 100));
    expect(scrollTo()).toHaveBeenCalledTimes(1);
    const arg = scrollTo().mock.calls[0][0] as ScrollToOptions;
    expect(arg.top).toBeCloseTo(1600 + 100 / SCALE);
    expect(arg.behavior).toBe('instant');
    // The indicator is exactly 100 px lower, without waiting for the scroll event.
    expect(parseFloat(indicator.style.top)).toBeCloseTo(top + 100);
  });

  it('keeps the page where it is while the pointer stays where it grabbed', () => {
    const { indicator } = setup(1600);
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 20));
    fireEvent.pointerMove(indicator, pointer(MAP_TOP + 1600 * SCALE + 20));
    expect(scrollTo().mock.calls[0]?.[0]).toMatchObject({ top: expect.closeTo(1600) });
  });

  it('turns off the indicator transition and shows a grabbing cursor only while dragging', () => {
    const { indicator } = setup();
    expect(indicator.className).toContain('transition-[top,height]');
    expect(indicator.className).toContain('cursor-grab');
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 5));
    expect(indicator.className).not.toContain('transition-');
    expect(indicator.className).toContain('cursor-grabbing');
    fireEvent.pointerUp(indicator, pointer(MAP_TOP + 1600 * SCALE + 5));
    expect(indicator.className).toContain('transition-[top,height]');
  });

  it('stays inside the page when dragged past either end', () => {
    const { indicator } = setup(1600);
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 20));
    fireEvent.pointerMove(indicator, pointer(MAP_TOP + 5000));
    fireEvent.pointerMove(indicator, pointer(MAP_TOP - 300));
    expect(scrollTo().mock.calls.map(c => (c[0] as ScrollToOptions).top)).toEqual([TOTAL - VIEW, 0]);
  });

  it.each([
    ['pointerup', (el: Element) => fireEvent.pointerUp(el, pointer(300))],
    ['pointercancel', (el: Element) => fireEvent.pointerCancel(el, pointer(300))],
    ['lostpointercapture', (el: Element) => fireEvent.lostPointerCapture(el, pointer(300))],
  ])('stops following the pointer after %s', (_name, end) => {
    const { indicator } = setup(1600);
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 20));
    end(indicator);
    expect(indicator.className).not.toContain('cursor-grabbing');
    fireEvent.pointerMove(indicator, pointer(MAP_TOP + 400));
    expect(scrollTo()).not.toHaveBeenCalled();
  });

  it('does not jump when the click that ends a drag arrives', () => {
    const { indicator } = setup(1600);
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 20));
    fireEvent.pointerMove(indicator, pointer(MAP_TOP + 1600 * SCALE + 70));
    fireEvent.pointerUp(indicator, pointer(MAP_TOP + 1600 * SCALE + 70));
    scrollTo().mockClear();
    fireEvent.click(indicator);
    expect(scrollTo()).not.toHaveBeenCalled();
  });

  it('ignores other buttons, and a second finger', () => {
    const { indicator } = setup();
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 5, { button: 2 }));
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 5, { isPrimary: false, pointerId: 2 }));
    fireEvent.pointerMove(indicator, pointer(MAP_TOP + 500));
    expect(scrollTo()).not.toHaveBeenCalled();
    expect(Element.prototype.setPointerCapture).not.toHaveBeenCalled();
  });

  it('ignores moves from a pointer other than the one dragging', () => {
    const { indicator } = setup();
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 5));
    fireEvent.pointerMove(indicator, pointer(MAP_TOP + 500, { pointerId: 9 }));
    expect(scrollTo()).not.toHaveBeenCalled();
  });

  it('keeps dragging when some other pointer is released', () => {
    const { indicator } = setup();
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 5));
    fireEvent.pointerUp(indicator, pointer(MAP_TOP + 500, { pointerId: 9 }));
    fireEvent.pointerMove(indicator, pointer(MAP_TOP + 500));
    expect(scrollTo()).toHaveBeenCalledTimes(1);
  });

  it('prevents the default of the press, so nothing gets selected', () => {
    const { indicator } = setup();
    const notPrevented = fireEvent.pointerDown(indicator, pointer(MAP_TOP + 1600 * SCALE + 5));
    expect(notPrevented).toBe(false);
  });
});

describe('ScrollMinimap click', () => {
  it('centers the viewport on the click, smoothly', () => {
    const { minimap } = setup(0);
    fireEvent.click(minimap, { clientY: MAP_TOP + MAP_H / 2 });
    expect(scrollTo()).toHaveBeenCalledWith({ top: expect.closeTo(TOTAL / 2 - VIEW / 2), behavior: 'smooth' });
  });

  it('jumps without animation when motion is reduced', () => {
    reducedMotion = true;
    const { minimap } = setup(0);
    fireEvent.click(minimap, { clientY: MAP_TOP + 100 });
    expect(scrollTo().mock.calls[0][0]).toMatchObject({ behavior: 'auto' });
  });

  it('puts the indicator where it was clicked', () => {
    const { minimap, indicator } = setup(0);
    fireEvent.click(minimap, { clientY: MAP_TOP + 300 });
    const target = (scrollTo().mock.calls[0][0] as ScrollToOptions).top!;
    const height = parseFloat(indicator.style.height);
    expect(target * SCALE + height / 2).toBeCloseTo(300);
  });

  it('a click on the indicator itself is not a jump', () => {
    const { indicator } = setup(1600);
    fireEvent.click(indicator, { clientY: MAP_TOP + 1600 * SCALE + 10 });
    expect(scrollTo()).not.toHaveBeenCalled();
  });
});
