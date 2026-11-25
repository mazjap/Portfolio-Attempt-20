import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import ScrollMinimap from './ScrollMinimap';
import * as minimapLib from '../../lib/minimap';

// Counts how often a bar is rendered (code marks call this), to show that scrolling doesn't redraw bars.
vi.mock('../../lib/minimap', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/minimap')>();
  return { ...actual, sampleEvenly: vi.fn(actual.sampleEvenly) };
});

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
  // The minimap's track is where the mocked rect says; article blocks sit where their data-top says.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const isMap = this.hasAttribute('data-minimap-track');
    const top = isMap ? MAP_TOP : Number((this as HTMLElement).dataset.top ?? 0);
    const height = isMap ? MAP_H : Number((this as HTMLElement).dataset.h ?? 0);
    const width = isMap ? 56 : Number((this as HTMLElement).dataset.w ?? 600);
    return { top, bottom: top + height, left: 0, right: width, width, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return Number(this.dataset.h ?? 0);
  });
  // An image is loaded once it has data-loaded.
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(function (this: HTMLImageElement) {
    return this.dataset.loaded !== undefined;
  });
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(function (this: HTMLImageElement) {
    return this.dataset.loaded !== undefined ? 1280 : 0;
  });
  vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get').mockImplementation(function (this: HTMLImageElement) {
    return this.dataset.loaded !== undefined ? this.dataset.loaded : '';
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(minimapLib.sampleEvenly).mockClear();
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

function Page({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <>
      <article ref={ref}>{children ?? <p data-top="100" data-h="60">Some text.</p>}</article>
      <ScrollMinimap contentRef={ref} contentKey="post" />
    </>
  );
}

function setup(initialScrollY = 1600, children?: React.ReactNode) {
  scrollY = initialScrollY;
  const { container } = render(<Page>{children}</Page>);
  const minimap = container.querySelector<HTMLElement>('[data-minimap-track]')!;
  const indicator = container.querySelector<HTMLElement>('[data-minimap-indicator]')!;
  return { container, minimap, indicator };
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
    const { container, minimap } = setup();
    const root = container.querySelector('[aria-hidden="true"]')!;
    expect(root.contains(minimap)).toBe(true);
    expect(root.querySelector('a, button, input, [tabindex]')).toBeNull();
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

/** A short article: a title, an introduction, a photo, some code, and a second heading. */
function article() {
  return (
    <>
      <h1 data-top="100" data-h="40">
        Building it
        <a href="#building-it" data-heading-anchor aria-label="Link to this section">#</a>
      </h1>
      <p data-top="160" data-h="80">Intro text.</p>
      <p data-top="300" data-h="474">
        <img src="/media/photo.webp" alt="The finished board" data-top="300" data-h="474" data-loaded="/media/photo.w1280.webp" />
      </p>
      <pre data-top="900" data-h="250">
        <code>
          {'function add(a, b) {\n  '}
          <span className="hljs-comment">// sum them</span>
          {'\n  return a + b;\n}\n'}
        </code>
      </pre>
      <h2 data-top="1300" data-h="30">The   wiring</h2>
    </>
  );
}

const headingBars = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-minimap-heading]')];

describe('ScrollMinimap bars', () => {
  it('writes a heading out, without its # permalink', () => {
    const { minimap } = setup(0, article());
    const [h1, h2] = headingBars(minimap);
    expect(h1.textContent).toBe('Building it');
    expect(h2.textContent).toBe('The wiring');
    // Sized by level, and placed with the same scale as everything else.
    expect(h1.style.fontSize).toBe('7px');
    expect(h2.style.fontSize).toBe('6px');
    expect(parseFloat(h1.style.top)).toBeCloseTo((100 + 20) * SCALE - 4.5);
  });

  it('draws a bar instead of text when the next heading is too close to fit it', () => {
    const { minimap } = setup(0, (
      <>
        <h2 data-top="100" data-h="30">First</h2>
        <h2 data-top="140" data-h="30">Second</h2>
      </>
    ));
    const [first, second] = headingBars(minimap);
    expect(first.textContent).toBe(''); // 40 page px apart is 3.8 minimap px
    expect(second.textContent).toBe('Second');
  });

  it('shows an image as a thumbnail of the file the article loaded', () => {
    const { minimap } = setup(0, article());
    const thumbs = minimap.querySelectorAll<HTMLImageElement>('[data-minimap-image] img');
    expect(thumbs).toHaveLength(1);
    expect(thumbs[0].getAttribute('src')).toBe('/media/photo.w1280.webp');
    expect(parseFloat(thumbs[0].parentElement!.style.height)).toBeCloseTo(474 * SCALE);
  });

  it('leaves a gray box until the image has loaded, then fills in the thumbnail', async () => {
    const { container, minimap } = setup(0, article());
    const img = container.querySelector<HTMLImageElement>('article img')!;
    delete img.dataset.loaded;
    fireEvent.load(img); // rescan: not loaded yet
    await act(() => new Promise(r => setTimeout(r, 40)));
    expect(minimap.querySelector('[data-minimap-image] img')).toBeNull();
    expect(minimap.querySelector('[data-minimap-image]')).not.toBeNull();

    img.dataset.loaded = '/media/photo.w640.webp';
    fireEvent.load(img);
    await act(() => new Promise(r => setTimeout(r, 40)));
    expect(minimap.querySelector('[data-minimap-image] img')!.getAttribute('src')).toBe('/media/photo.w640.webp');
  });

  it('draws code as one mark per line, in the code block', () => {
    const { minimap } = setup(0, article());
    const block = minimap.querySelector<HTMLElement>('[data-minimap-code]')!;
    expect(block.children).toHaveLength(4); // function, comment, return, }
    const widths = [...block.children].map(m => parseFloat((m as HTMLElement).style.width));
    expect(widths[0]).toBeGreaterThan(widths[3]); // `function add(a, b) {` is longer than `}`
    const colors = [...block.children].map(m => (m as HTMLElement).style.background);
    expect(colors[1]).toContain('--xcode-green'); // the comment
    expect(colors[0]).toContain('--xcode-accent');
  });

  it('shows the full heading text beside the minimap while the mouse is over it, and not after', () => {
    const { container, minimap } = setup(0, article());
    const [h1] = headingBars(minimap);
    expect(container.querySelector('[data-minimap-preview]')).toBeNull();
    fireEvent.pointerEnter(h1, { pointerType: 'mouse' });
    expect(container.querySelector('[data-minimap-preview]')!.textContent).toContain('Building it');
    fireEvent.pointerLeave(h1);
    expect(container.querySelector('[data-minimap-preview]')).toBeNull();
  });

  describe('when a rescan changes what is on the page under an open preview', () => {
    /** Hovers the photo, then adds a heading before it and rescans (as when something above loads). */
    async function hoverThenInsertAbove(shiftPhoto: boolean) {
      const { container, minimap } = setup(0, article());
      fireEvent.pointerEnter(minimap.querySelector('[data-minimap-image]')!, { pointerType: 'mouse' });
      expect(container.querySelector('[data-minimap-preview] img')).not.toBeNull();

      const article_ = container.querySelector('article')!;
      const photo = article_.querySelector<HTMLImageElement>('img')!;
      const added = document.createElement('h2');
      added.textContent = 'Added above';
      added.dataset.top = '200';
      added.dataset.h = '30';
      article_.insertBefore(added, photo.parentElement);
      if (shiftPhoto) photo.dataset.top = '360'; // pushed down by whatever was added
      fireEvent.load(photo);
      await act(() => new Promise(r => setTimeout(r, 40)));
      return container;
    }

    it('keeps previewing the same image when it has not moved, though its index in the list did', async () => {
      const container = await hoverThenInsertAbove(false);
      const preview = container.querySelector('[data-minimap-preview]')!;
      expect(preview.querySelector('img')!.getAttribute('src')).toBe('/media/photo.w1280.webp');
      expect(preview.textContent).not.toContain('Added above'); // the heading now at the old index
    });

    it('keeps the preview when the rescanned position differs only by rounding', async () => {
      const { container, minimap } = setup(0, article());
      fireEvent.pointerEnter(minimap.querySelector('[data-minimap-image]')!, { pointerType: 'mouse' });
      const photo = container.querySelector<HTMLImageElement>('article img')!;
      photo.dataset.top = '300.25';
      fireEvent.load(photo);
      await act(() => new Promise(r => setTimeout(r, 40)));
      expect(container.querySelector('[data-minimap-preview] img')).not.toBeNull();
    });

    it('drops the preview, rather than showing another element, when the image has moved', async () => {
      const container = await hoverThenInsertAbove(true);
      expect(container.querySelector('[data-minimap-preview]')).toBeNull();
    });
  });

  it('shows a larger image, with its alt text, while the mouse is over it', () => {
    const { container, minimap } = setup(0, article());
    fireEvent.pointerEnter(minimap.querySelector('[data-minimap-image]')!, { pointerType: 'pen' });
    const preview = container.querySelector('[data-minimap-preview]')!;
    expect(preview.querySelector('img')!.getAttribute('src')).toBe('/media/photo.w1280.webp');
    expect(preview.textContent).toContain('The finished board');
  });

  it('does not show a preview for a touch', () => {
    const { container, minimap } = setup(0, article());
    fireEvent.pointerEnter(headingBars(minimap)[0], { pointerType: 'touch' });
    expect(container.querySelector('[data-minimap-preview]')).toBeNull();
  });

  it('hides the preview once a drag starts', () => {
    const { container, minimap, indicator } = setup(0, article());
    fireEvent.pointerEnter(headingBars(minimap)[0], { pointerType: 'mouse' });
    fireEvent.pointerDown(indicator, pointer(MAP_TOP + 5));
    expect(container.querySelector('[data-minimap-preview]')).toBeNull();
    fireEvent.pointerUp(indicator, pointer(MAP_TOP + 5));
    expect(container.querySelector('[data-minimap-preview]')).toBeNull(); // and it doesn't come back
  });

  it('puts a clicked heading at the top of the window, and not the minimap-wide jump', () => {
    const { minimap } = setup(0, article());
    fireEvent.click(headingBars(minimap)[1], { clientY: MAP_TOP + 1315 * SCALE });
    expect(scrollTo()).toHaveBeenCalledTimes(1);
    expect(scrollTo()).toHaveBeenCalledWith({ top: 1300 - 64, behavior: 'smooth' });
  });

  it('puts a clicked image at the top of the window too', () => {
    const { minimap } = setup(0, article());
    fireEvent.click(minimap.querySelector('[data-minimap-image]')!);
    expect(scrollTo()).toHaveBeenCalledWith({ top: 300 - 64, behavior: 'smooth' });
  });

  it('leaves everything but headings and images to the minimap click', () => {
    const { minimap } = setup(0, article());
    const bars = [...minimap.children].filter(el => !el.hasAttribute('data-minimap-indicator'));
    const passive = bars.filter(el => !el.hasAttribute('data-minimap-heading') && !el.hasAttribute('data-minimap-image'));
    expect(passive.length).toBeGreaterThan(0); // text lines and the code block
    expect(passive.every(el => el.className.includes('pointer-events-none'))).toBe(true);
    expect(bars.filter(el => el.hasAttribute('data-minimap-heading')).every(el => el.className.includes('pointer-events-auto'))).toBe(true);
  });

  it('only redraws the viewport indicator when you scroll, not the bars', async () => {
    const { indicator } = setup(0, article());
    const before = indicator.style.top;
    const draws = vi.mocked(minimapLib.sampleEvenly).mock.calls.length;
    expect(draws).toBeGreaterThan(0);
    scrollY = 2000;
    fireEvent.scroll(window);
    await act(() => new Promise(r => setTimeout(r, 40)));
    expect(indicator.style.top).not.toBe(before);
    expect(vi.mocked(minimapLib.sampleEvenly).mock.calls.length).toBe(draws);
  });

  it('works in the light and dark themes alike: text and marks use theme tokens', () => {
    const { minimap } = setup(0, article());
    const chip = headingBars(minimap)[0];
    expect(chip.className).toContain('text-xcode-accent');
    expect(chip.className).toContain('bg-xcode-bg-light');
    expect(chip.className).toContain('dark:bg-xcode-bg');
  });

  it('only animates hover changes when motion is allowed', () => {
    const { minimap } = setup(0, article());
    expect(headingBars(minimap)[0].className).toContain('motion-safe:transition-colors');
    expect(minimap.querySelector('[data-minimap-image]')!.className).toContain('motion-safe:transition-shadow');
  });
});
