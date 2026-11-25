import { describe, expect, it } from 'vitest';
import {
  grabOffset,
  indicatorRect,
  maxScrollTop,
  minimapScale,
  scrollTopForClick,
  scrollTopForDrag,
  type MinimapSize,
} from './minimap';

// An 8000 px page, an 800 px viewport, and a minimap 752 px tall: 0.094 minimap pixels per page pixel.
const size: MinimapSize = { totalH: 8000, viewH: 800, containerH: 752 };

describe('minimap geometry', () => {
  it('draws the viewport at the same scale as the page', () => {
    expect(minimapScale(size)).toBeCloseTo(0.094);
    expect(maxScrollTop(size)).toBe(7200);
    const { top, height } = indicatorRect(1600, size);
    expect(top).toBeCloseTo(150.4);
    expect(height).toBeCloseTo(75.2);
    // Scrolled all the way down, the indicator's bottom edge meets the minimap's.
    const end = indicatorRect(7200, size);
    expect(end.top + end.height).toBeCloseTo(752);
  });

  it('never makes the indicator taller than the minimap', () => {
    expect(indicatorRect(0, { totalH: 500, viewH: 800, containerH: 752 }).height).toBe(752);
    expect(maxScrollTop({ totalH: 500, viewH: 800, containerH: 752 })).toBe(0);
  });

  it('centers the viewport on a click, so the indicator lands where you clicked', () => {
    const top = scrollTopForClick(376, size); // the middle of the minimap
    expect(top).toBeCloseTo(3600);
    const { top: t, height } = indicatorRect(top, size);
    expect(t + height / 2).toBeCloseTo(376);
  });

  it('keeps clicks near either end inside the page', () => {
    expect(scrollTopForClick(0, size)).toBe(0);
    expect(scrollTopForClick(5, size)).toBe(0);
    expect(scrollTopForClick(752, size)).toBe(7200);
  });

  it('keeps the grabbed point under the pointer while dragging', () => {
    const scrollY = 1600;
    const { top } = indicatorRect(scrollY, size);
    const y = top + 20; // pressed 20 px below the indicator's top edge
    const grab = grabOffset(y, scrollY, size);
    expect(grab).toBeCloseTo(20);
    // With no movement the page doesn't move.
    expect(scrollTopForDrag(y, grab, size)).toBeCloseTo(scrollY);
    // Moving the pointer 100 px moves the indicator exactly 100 px.
    const next = scrollTopForDrag(y + 100, grab, size);
    expect(indicatorRect(next, size).top).toBeCloseTo(top + 100);
  });

  it('clamps a drag past either end', () => {
    expect(scrollTopForDrag(-300, 20, size)).toBe(0);
    expect(scrollTopForDrag(5000, 20, size)).toBe(7200);
  });
});
