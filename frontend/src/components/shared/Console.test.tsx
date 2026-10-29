import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Console from './Console';

function setup() {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }));
  render(<MemoryRouter><Console /></MemoryRouter>);
  return { fetchMock, user: userEvent.setup() };
}

describe('Console', () => {
  it("doesn't fetch anything until it's opened", async () => {
    const { fetchMock, user } = setup();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Developer console' }));
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Developer console' })).toBeTruthy();
  });

  it('completes with Tab, but lets Shift+Tab and Tab on an empty line move focus', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Developer console' }));
    const input = screen.getByRole('textbox', { name: 'Console input' });
    expect(document.activeElement).toBe(input);

    await user.type(input, 'whoa');
    await user.clear(input);
    await user.type(input, 'who');
    await user.tab();
    expect((input as HTMLInputElement).value).toBe('whoami');
    expect(document.activeElement).toBe(input);

    await user.tab({ shift: true });
    expect(document.activeElement).not.toBe(input);
  });

  it('Escape closes it and returns focus to the toggle', async () => {
    const { user } = setup();
    const toggle = screen.getByRole('button', { name: 'Developer console' });
    await user.click(toggle);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
