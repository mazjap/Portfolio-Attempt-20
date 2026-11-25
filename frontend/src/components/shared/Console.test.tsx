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

  describe('commands', () => {
    async function openConsole() {
      const ctx = setup();
      await ctx.user.click(screen.getByRole('button', { name: 'Developer console' }));
      const input = screen.getByRole('textbox', { name: 'Console input' }) as HTMLInputElement;
      const run = async (cmd: string) => { await ctx.user.type(input, `${cmd}{Enter}`); };
      return { ...ctx, input, run };
    }
    const log = () => screen.getByRole('log').textContent ?? '';

    it('prints unknown commands as not found', async () => {
      const { run } = await openConsole();
      await run('frobnicate');
      expect(log()).toContain('zsh: command not found: frobnicate');
    });

    it('keeps the original joke: rm -rf / is "nice try." (with or without sudo)', async () => {
      const { run } = await openConsole();
      await run('rm -rf /');
      await run('sudo rm -rf ~');
      expect(screen.getAllByText('nice try.')).toHaveLength(2);
    });

    it('lists the real new commands in help, hints at hidden ones, and spoils none', async () => {
      const { run } = await openConsole();
      await run('help');
      const text = log();
      for (const real of ['vim', 'pet koda', 'man jordan', 'history', 'shortcuts', 'exit']) expect(text).toContain(real);
      expect(text).toContain('a few more are hiding');
      for (const secret of ['sudo', 'git', 'xcodebuild', 'fortune', 'make', 'emacs', 'nano']) expect(text).not.toContain(secret);
    });

    it('completes the real commands with Tab, but not the hidden ones', async () => {
      const { user, input } = await openConsole();
      await user.type(input, 'shor');
      await user.tab();
      expect(input.value).toBe('shortcuts');
      await user.clear(input);
      await user.type(input, 'ex');
      await user.tab();
      expect(input.value).toBe('exit');
      for (const [prefix, full] of [['vi', 'vim'], ['pe', 'pet koda'], ['man', 'man jordan']]) {
        await user.clear(input);
        await user.type(input, prefix);
        await user.tab();
        expect(input.value).toBe(full);
      }
      for (const prefix of ['su', 'gi', 'xcode', 'fort', 'kod', 'mak', 'em', 'na']) {
        await user.clear(input);
        await user.type(input, prefix);
        await user.tab();
        expect(input.value).toBe(prefix);
      }
    });

    it('sudo is refused', async () => {
      const { run } = await openConsole();
      await run('sudo ls');
      expect(log()).toContain('visitor is not in the sudoers file');
    });

    it('git status, log, and push', async () => {
      const { run } = await openConsole();
      await run('git status');
      expect(log()).toContain('nothing to commit, working tree clean');
      await run('git log');
      expect(log()).toContain('Add more Easter eggs');
      await run('git push origin main');
      expect(log()).toContain('failed to push some refs');
      await run('git frobnicate');
      expect(log()).toContain("git: 'frobnicate' is not something");
    });

    it('xcodebuild succeeds', async () => {
      const { run } = await openConsole();
      await run('xcodebuild');
      expect(log()).toContain('** BUILD SUCCEEDED **');
      await run('xcodebuild -scheme Portfolio test');
      expect(log()).toContain('** TEST SUCCEEDED **');
    });

    it('history lists the commands so far, oldest first, including itself', async () => {
      const { run } = await openConsole();
      await run('pwd');
      await run('whoami');
      await run('history');
      const lines = Array.from(screen.getByRole('log').querySelectorAll('div')).map(d => d.textContent);
      expect(lines).toContain('    1  pwd');
      expect(lines).toContain('    2  whoami');
      expect(lines).toContain('    3  history');
    });

    it('shortcuts lists them, and says ⌘R is left alone', async () => {
      const { run } = await openConsole();
      await run('shortcuts');
      expect(log()).toContain('⌘B');
      expect(log()).toContain('⌘⇧K');
      expect(log()).toContain('⌃⌘J');
      expect(log()).toContain('⌃⌘Y');
      expect(log()).toContain('⌘R is left alone');
    });

    it('exit prints logout, closes the console, and returns focus to the toggle', async () => {
      const { run } = await openConsole();
      await run('exit');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Developer console' }));
      await userEvent.setup().click(screen.getByRole('button', { name: 'Developer console' }));
      expect(log()).toContain('[Process completed]');
    });

    it('emacs and nano are one-liners; :q outside vim is just not a command', async () => {
      const { run } = await openConsole();
      await run('emacs');
      expect(log()).toContain('this may take a few years');
      await run('nano');
      expect(log()).toContain('not installed');
      await run(':q');
      expect(log()).toContain('zsh: command not found: :q');
    });

    it('make coffee is a teapot, and sandwiches need sudo', async () => {
      const { run } = await openConsole();
      await run('make coffee');
      expect(log()).toContain("I'm a teapot");
      await run('make me a sandwich');
      expect(log()).toContain('What? Make it yourself.');
      await run('sudo make me a sandwich');
      expect(screen.getByText('Okay.')).toBeTruthy();
    });

    it('rm refuses politely, and fortune answers', async () => {
      const { run } = await openConsole();
      await run('rm notes.txt');
      expect(log()).toContain('this portfolio is read-only');
      const before = log().length;
      await run('fortune');
      expect(log().length).toBeGreaterThan(before + 'fortune'.length + 20);
    });

    it('pet koda pets the dog; koda is a hidden alias; pet needs a pet', async () => {
      const { run } = await openConsole();
      await run('pet koda');
      expect(screen.getAllByText(/🐕/)).toHaveLength(1);
      await run('koda');
      expect(screen.getAllByText(/🐕/)).toHaveLength(2);
      await run('pet');
      expect(log()).toContain('pet: pet what?');
      await run('pet cat');
      expect(log()).toContain('pet: cat: No such pet.');
    });

    it('man jordan prints a manual page that only says what whoami says', async () => {
      const { run } = await openConsole();
      await run('man jordan');
      const page = log();
      for (const part of ['NAME', 'SYNOPSIS', 'DESCRIPTION', 'SEE ALSO', 'contact(1)', 'whoami(1)', 'Utah', 'TrekPoint', 'QMK', 'Koda']) {
        expect(page).toContain(part);
      }
      // The page wraps lines by hand, so compare with the whitespace collapsed.
      const flat = (text: string) => text.replace(/\s+/g, ' ');
      await run('whoami');
      const everything = flat(log());
      for (const fact of ['iOS Developer from Utah', 'Currently: building TrekPoint, writing too much QMK firmware.', 'Previously: building this portfolio website.']) {
        expect(flat(page)).toContain(fact);
        expect(everything).toContain(fact);
      }
      await run('man');
      expect(log()).toContain('What manual page do you want?');
      await run('man ls');
      expect(log()).toContain('No manual entry for ls');
    });

    it('keeps whitespace in output lines (man page indents, history and help columns)', async () => {
      const { run } = await openConsole();
      await run('man jordan');
      await run('history');
      const row = (text: string) => Array.from(screen.getByRole('log').querySelectorAll('div')).find(d => d.textContent === text);
      for (const text of ['    jordan - iOS developer from Utah', '    1  man jordan']) {
        const el = row(text);
        expect(el, text).toBeTruthy();
        expect(el?.className).toContain('whitespace-pre-wrap');
        expect(el?.className).toContain('break-words');
      }
    });

    describe('vim', () => {
      const prompt = () => screen.getByRole('dialog').querySelector('.text-xcode-green')?.textContent ?? '';
      const inVim = () => prompt() === ':';

      it('takes over the console: tildes, a status line, a ":" prompt, and a vim title', async () => {
        const { run } = await openConsole();
        expect(prompt()).toContain('$');
        await run('vim');
        expect(inVim()).toBe(true);
        expect(screen.getAllByText('~')).toHaveLength(3);
        expect(log()).toContain('"[No Name]" 0L, 0B');
        expect(screen.getByRole('dialog').textContent).toContain('Terminal — vim');
        expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Console input' }));
      });

      it('shows the file name it was given, for vi and nvim too, ignoring flags', async () => {
        const { run } = await openConsole();
        await run('nvim -n notes.txt');
        expect(log()).toContain('"notes.txt" 0L, 0B');
        expect(inVim()).toBe(true);
      });

      it('answers :q and :wq with E37 and stays in vim (with or without the colon)', async () => {
        const { run } = await openConsole();
        await run('vim');
        for (const q of [':q', ':wq', 'q', ':x', ':qa']) {
          await run(q);
          expect(inVim()).toBe(true);
        }
        expect(screen.getAllByText('E37: No write since last change (add ! to override)')).toHaveLength(5);
        expect(screen.getByRole('dialog')).toBeTruthy();
      });

      it('echoes lines as vim commands, not shell commands', async () => {
        const { run } = await openConsole();
        await run('vim');
        await run('q');
        expect(screen.getByText(':q')).toBeTruthy();
        expect(log()).not.toContain('> q');
      });

      it(':q! leaves with a message and brings back the shell', async () => {
        const { run } = await openConsole();
        await run('vim');
        await run(':q!');
        expect(log()).toContain('vim: nothing was saved. Back to zsh.');
        expect(inVim()).toBe(false);
        expect(screen.getByRole('dialog').textContent).toContain('Terminal — zsh');
        await run('pwd');
        expect(log()).toContain('/Users/Jordan/Developer');
      });

      it('Escape leaves vim but not the console; a second Escape closes the console', async () => {
        const { user, run } = await openConsole();
        await run('vim');
        await user.keyboard('{Escape}');
        expect(inVim()).toBe(false);
        expect(log()).toContain('vim: nothing was saved. Back to zsh.');
        expect(screen.getByRole('dialog')).toBeTruthy();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      it('gives vim-flavored answers to everything else', async () => {
        const { run } = await openConsole();
        await run('vim notes.txt');
        await run(':w');
        expect(log()).toContain('"notes.txt" [New] 0L, 0B written');
        await run(':w other.txt');
        expect(log()).toContain('"other.txt" [New] 0L, 0B written');
        await run(':help');
        expect(log()).toContain('E149: Sorry, no help for help.txt');
        await run('hello');
        expect(log()).toContain('E492: Not an editor command: hello');
        await run(':set number');
        await run('ls');
        expect(log()).toContain('E492: Not an editor command: ls');
        expect(log()).not.toContain('projects');
        expect(inVim()).toBe(true);
      });

      it(':w with no file name is E32', async () => {
        const { run } = await openConsole();
        await run('vim');
        await run(':w');
        expect(log()).toContain('E32: No file name');
      });

      it('keeps the arrow keys working on vim lines, and keeps them out of the shell history', async () => {
        const { user, input, run } = await openConsole();
        await run('vim notes.txt');
        await run(':wq');
        await run(':q!');
        await user.type(input, '{ArrowUp}');
        expect(input.value).toBe('vim notes.txt');
        await user.clear(input);
        await run('history');
        const lines = Array.from(screen.getByRole('log').querySelectorAll('div')).map(d => d.textContent);
        expect(lines).toContain('    1  vim notes.txt');
        expect(lines).toContain('    2  history');
        expect(lines.some(l => l?.includes(':wq') && /^\s+\d+\s/.test(l))).toBe(false);
        expect(lines.some(l => l?.includes(':q!') && /^\s+\d+\s/.test(l))).toBe(false);
      });

      it('recalls earlier vim lines with ArrowUp while in vim, not shell commands', async () => {
        const { user, input, run } = await openConsole();
        await run('pwd');
        await run('vim');
        await run(':wq');
        await run(':w');
        await user.type(input, '{ArrowUp}');
        expect(input.value).toBe(':w');
        await user.type(input, '{ArrowUp}');
        expect(input.value).toBe(':wq');
        await user.type(input, '{ArrowUp}');
        expect(input.value).toBe(':wq');
        await user.type(input, '{ArrowDown}');
        expect(input.value).toBe(':w');
        await user.type(input, '{ArrowDown}');
        expect(input.value).toBe('');
      });

      it('does not Tab-complete, so Tab moves focus as usual', async () => {
        const { user, input } = await openConsole();
        await user.type(input, 'vim{Enter}');
        await user.type(input, 'hel');
        await user.tab();
        expect(input.value).toBe('hel');
        expect(document.activeElement).not.toBe(input);
      });

      it('clear wipes the screen and leaves vim', async () => {
        const { run } = await openConsole();
        await run('vim');
        await run('clear');
        expect(inVim()).toBe(false);
        expect(log()).not.toContain('~');
      });

      it('closing the console (close button, toggle, Escape from the shell, exit) resets it', async () => {
        const { user, run } = await openConsole();
        await run('vim');
        await user.click(screen.getByRole('button', { name: 'Close console' }));
        await user.click(screen.getByRole('button', { name: 'Developer console' }));
        expect(inVim()).toBe(false);

        await run('vim');
        await user.click(screen.getByRole('button', { name: 'Developer console' }));
        await user.click(screen.getByRole('button', { name: 'Developer console' }));
        expect(inVim()).toBe(false);
        expect(screen.getByRole('dialog').textContent).toContain('Terminal — zsh');
      });
    });
  });
});
