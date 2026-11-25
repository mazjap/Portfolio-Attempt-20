import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

function setup() {
  return render(
    <MemoryRouter>
      <Navbar />
      <input aria-label="field" />
      <textarea aria-label="area" />
      <select aria-label="pick"><option>a</option></select>
      <div aria-label="rich" contentEditable="true" suppressContentEditableWarning tabIndex={0} />
    </MemoryRouter>,
  );
}

/** Dispatches a keydown on `target`; returns false if the page called preventDefault. */
function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): boolean {
  return fireEvent.keyDown(target, { key, ...init });
}

const status = () => screen.getByRole('status');
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Navbar shortcuts', () => {
  it('keeps a (silent) status region mounted so toasts get announced', () => {
    setup();
    expect(status().textContent).toBe('');
    expect(status().className).toContain('pointer-events-none');
  });

  it('⌘B builds: Building…, then Build Succeeded with the time, then nothing', () => {
    setup();
    expect(press('b', { metaKey: true })).toBe(false);
    expect(status().textContent).toContain('Building…');
    advance(900);
    expect(status().textContent).toContain('Build Succeeded');
    expect(status().textContent).toContain(new Date().toLocaleTimeString());
    advance(2600);
    expect(status().textContent).toBe('');
  });

  it('⌘⇧K cleans the build folder, then says Done., then goes away', () => {
    setup();
    expect(press('K', { metaKey: true, shiftKey: true })).toBe(false);
    expect(status().textContent).toBe('Clean Build Folder…');
    advance(700);
    expect(status().textContent).toBe('Clean Build Folder… Done.');
    advance(1800);
    expect(status().textContent).toBe('');
  });

  it('⌃⌘J says you are already at the definition', () => {
    setup();
    expect(press('j', { metaKey: true, ctrlKey: true })).toBe(false);
    expect(status().textContent).toBe('Jump to Definition: you are already here.');
    advance(2800);
    expect(status().textContent).toBe('');
  });

  it('⌃⌘Y continues, and the program exits with code 0', () => {
    setup();
    expect(press('y', { metaKey: true, ctrlKey: true })).toBe(false);
    expect(status().textContent).toContain('Continuing');
    advance(600);
    expect(status().textContent).toBe('Program ended with exit code: 0');
    advance(2400);
    expect(status().textContent).toBe('');
  });

  it('a new shortcut replaces the toast on screen and cancels the old one’s timers', () => {
    setup();
    press('b', { metaKey: true });
    advance(300);
    press('K', { metaKey: true, shiftKey: true });
    expect(status().textContent).toBe('Clean Build Folder…');
    advance(700);
    expect(status().textContent).toBe('Clean Build Folder… Done.');
    advance(1800);
    expect(status().textContent).toBe('');
  });

  it('holding a shortcut down does not restart the toast', () => {
    setup();
    press('b', { metaKey: true });
    advance(900);
    expect(status().textContent).toContain('Build Succeeded');
    expect(press('b', { metaKey: true, repeat: true })).toBe(false);
    expect(status().textContent).toContain('Build Succeeded');
  });

  it('is ignored while typing in a field, a textarea, a select, or editable text', () => {
    setup();
    for (const label of ['field', 'area', 'pick', 'rich']) {
      const el = screen.getByLabelText(label);
      expect(press('b', { metaKey: true }, el)).toBe(true);
      expect(press('K', { metaKey: true, shiftKey: true }, el)).toBe(true);
      expect(press('j', { metaKey: true, ctrlKey: true }, el)).toBe(true);
      expect(press('y', { metaKey: true, ctrlKey: true }, el)).toBe(true);
      expect(status().textContent).toBe('');
    }
  });

  it.each([
    ['b alone', 'b', {}],
    ['Ctrl+B (bold, or Windows/Linux)', 'b', { ctrlKey: true }],
    ['⌘⌥B', 'b', { metaKey: true, altKey: true }],
    ['⌃⌘B', 'b', { metaKey: true, ctrlKey: true }],
    ['⌘⇧B (bookmarks bar)', 'B', { metaKey: true, shiftKey: true }],
    ['⌘K (search)', 'k', { metaKey: true }],
    ['⌘R (reload)', 'r', { metaKey: true }],
    ['⌘⇧R (hard reload)', 'R', { metaKey: true, shiftKey: true }],
    ['⌘F (find)', 'f', { metaKey: true }],
    ['⌘L (address bar)', 'l', { metaKey: true }],
    ['⌘T (new tab)', 't', { metaKey: true }],
    ['⌘W (close tab)', 'w', { metaKey: true }],
    ['⌘P (print)', 'p', { metaKey: true }],
    ['⌘S (save)', 's', { metaKey: true }],
    ['⌘D (bookmark)', 'd', { metaKey: true }],
    ['⌘U (view source in Firefox)', 'u', { metaKey: true }],
    ['⌘. (stop loading in Safari)', '.', { metaKey: true }],
    ['⌘J (downloads)', 'j', { metaKey: true }],
    ['⌘Y (history)', 'y', { metaKey: true }],
    ['⌘⇧T (reopen tab)', 'T', { metaKey: true, shiftKey: true }],
    ['⌘⌥I (dev tools)', 'i', { metaKey: true, altKey: true }],
    ['⌘1 (first tab)', '1', { metaKey: true }],
    ['⌘[ (back)', '[', { metaKey: true }],
    ['Ctrl+J (downloads on Windows/Linux)', 'j', { ctrlKey: true }],
    ['Ctrl+Y (redo or history)', 'y', { ctrlKey: true }],
    ['Ctrl+Shift+K (Firefox console)', 'K', { ctrlKey: true, shiftKey: true }],
    ['⌃⌘⇧J', 'J', { metaKey: true, ctrlKey: true, shiftKey: true }],
    ['⌃⌘⌥Y', 'y', { metaKey: true, ctrlKey: true, altKey: true }],
  ])('leaves %s to the browser', (_name, key, init) => {
    setup();
    expect(press(key, init)).toBe(true);
    expect(status().textContent).toBe('');
  });
});

describe('Konami code', () => {
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  const enter = (keys: string[], target?: Element) => keys.forEach(k => press(k, {}, target));

  it('unlocks an achievement toast, without blocking any key', () => {
    setup();
    for (const k of code) expect(press(k)).toBe(true);
    expect(status().textContent).toBe('★  Achievement unlocked: Konami Code');
    advance(3200);
    expect(status().textContent).toBe('');
  });

  it('works with Caps Lock on, or a bare Shift key pressed along the way', () => {
    setup();
    enter(code.slice(0, 8));
    press('Shift', { shiftKey: true });
    enter(['B', 'A']);
    expect(status().textContent).toContain('Konami');
  });

  it('does nothing for a broken sequence, a partial one, or a missing key', () => {
    setup();
    enter(code.slice(0, 9));
    enter(['x', 'a']);
    enter([...code.slice(0, 3), ...code.slice(4)]);
    expect(status().textContent).toBe('');
  });

  it('still finds the code after extra Up presses at the start', () => {
    setup();
    enter(['ArrowUp', ...code]);
    expect(status().textContent).toContain('Konami');
  });

  it('can be repeated', () => {
    setup();
    enter(code);
    advance(3200);
    enter(code);
    expect(status().textContent).toContain('Konami');
  });

  it('is ignored when keys are held down (auto-repeat) or have ⌘, Ctrl, or Alt held', () => {
    setup();
    enter(code.slice(0, 8));
    press('b', { metaKey: true });
    advance(4000);
    enter(['b', 'a']);
    expect(status().textContent).toBe('');

    enter(code.slice(0, 8));
    press('b', { repeat: true });
    press('b', { repeat: true });
    enter(['a']);
    expect(status().textContent).toBe('');
  });

  it('is ignored while typing, and typing in between starts it over', () => {
    setup();
    const field = screen.getByLabelText('field');
    enter(code, field);
    expect(status().textContent).toBe('');

    enter(code.slice(0, 8));
    press('b', {}, field);
    enter(['b', 'a']);
    expect(status().textContent).toBe('');
  });
});
