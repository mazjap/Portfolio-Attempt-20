import { describe, expect, it } from 'vitest';
import { COLUMN_BUDGET, EXTRA_COMPLETIONS, HELP_LINES, MAN_JORDAN, runExtraCommand, runVimLine } from './consoleCommands';

const ctx = { history: ['ls', 'pwd'] };

describe('runExtraCommand', () => {
  it('returns null for anything it does not know, including near misses and wrong case', () => {
    for (const cmd of ['', 'ls', 'Sudo', 'gitx', 'history2', 'echo hi', 'koda2', ':q', 'cat']) {
      expect(runExtraCommand(cmd, ctx)).toBeNull();
    }
  });

  it('collapses extra whitespace', () => {
    expect(runExtraCommand('  git    status ', ctx)?.lines[0]).toBe('On branch main');
    expect(runExtraCommand('sudo   make me   a sandwich', ctx)?.lines).toEqual(['Okay.']);
  });

  it('fortune picks from the list with the random it is given, and survives a random of 1', () => {
    const first = runExtraCommand('fortune', { ...ctx, random: () => 0 })?.lines[0];
    const last = runExtraCommand('fortune', { ...ctx, random: () => 0.9999 })?.lines[0];
    const edge = runExtraCommand('fortune', { ...ctx, random: () => 1 })?.lines[0];
    expect(first).toBeTruthy();
    expect(last).toBeTruthy();
    expect(last).not.toBe(first);
    expect(edge).toBeTruthy();
  });

  it('exit and logout ask the console to close', () => {
    expect(runExtraCommand('exit', ctx)?.exit).toBe(true);
    expect(runExtraCommand('logout', ctx)?.exit).toBe(true);
    expect(runExtraCommand('history', ctx)?.exit).toBeUndefined();
  });

  it('marks refusals as errors and answers as output', () => {
    expect(runExtraCommand('sudo ls', ctx)?.type).toBe('error');
    expect(runExtraCommand('rm -rf /', ctx)).toEqual({ lines: ['nice try.'], type: 'error' });
    expect(runExtraCommand('git status', ctx)?.type).toBeUndefined();
  });

  it('xcodebuild picks the right action', () => {
    expect(runExtraCommand('xcodebuild clean', ctx)?.lines).toContain('** CLEAN SUCCEEDED **');
    expect(runExtraCommand('xcodebuild -project A.xcodeproj', ctx)?.lines).toContain('** BUILD SUCCEEDED **');
  });

  it('only real commands are advertised', () => {
    expect(EXTRA_COMPLETIONS).toEqual(['vim', 'pet koda', 'man jordan', 'history', 'shortcuts', 'exit']);
    for (const name of EXTRA_COMPLETIONS) expect(HELP_LINES.some(l => l.trim().startsWith(name))).toBe(true);
  });

  it('vim starts a session with the file name, and man only knows jordan', () => {
    expect(runExtraCommand('vim', ctx)?.vim).toEqual({ file: null });
    expect(runExtraCommand('vi a.txt', ctx)?.vim).toEqual({ file: 'a.txt' });
    expect(runExtraCommand('man ls', ctx)).toMatchObject({ type: 'error', lines: ['No manual entry for ls'] });
    expect(runExtraCommand('man jordan please', ctx)?.type).toBe('error');
  });
});

describe('runVimLine', () => {
  const session = { file: null };

  it('refuses to quit without !, and leaves with it', () => {
    for (const q of ['q', ':q', ':quit', ':wq', ':x', ':qa', '::q']) {
      expect(runVimLine(q, session)).toMatchObject({ type: 'error', lines: ['E37: No write since last change (add ! to override)'] });
      expect(runVimLine(q, session).leave).toBeUndefined();
    }
    for (const q of [':q!', 'q!', ':qa!', ':wq!', ':cq!']) {
      expect(runVimLine(q, session).leave).toBe(true);
    }
  });

  it('prints nothing for a bare colon or :set, and E492 for the unknown', () => {
    expect(runVimLine(':', session).lines).toEqual([]);
    expect(runVimLine(':set nu', session).lines).toEqual([]);
    expect(runVimLine('whoami', session).lines).toEqual(['E492: Not an editor command: whoami']);
  });
});

describe('column layout', () => {
  const tooWide = (lines: string[]) => lines.filter(l => [...l].length > COLUMN_BUDGET);

  it('keeps help, the man page, and shortcuts within the console column budget', () => {
    expect(tooWide(HELP_LINES)).toEqual([]);
    expect(tooWide(MAN_JORDAN)).toEqual([]);
    expect(tooWide(runExtraCommand('shortcuts', ctx)?.lines ?? [])).toEqual([]);
    expect(tooWide(runExtraCommand('man jordan', ctx)?.lines ?? [])).toEqual([]);
  });

  it('indents the man page with spaces (which the console preserves) and lays help out in aligned columns', () => {
    expect(MAN_JORDAN[3]).toMatch(/^ {4}\S/);
    const dashes = HELP_LINES.filter(l => l.includes('—')).map(l => l.indexOf('—'));
    expect(new Set(dashes).size).toBe(1);
  });
});
