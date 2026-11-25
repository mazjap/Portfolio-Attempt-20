import { SHORTCUTS } from './shortcuts';

/** What a console command prints, and whether it also closes the console. */
export interface CommandOutput {
  lines: string[];
  type?: 'output' | 'error';
  /** Close the console after printing (`exit`). */
  exit?: boolean;
  /** Put the console in the fake vim mode (`vim`). */
  vim?: VimSession;
}

/** The console is "in vim" while this exists. `file` is the name given to `vim`, if any. */
export interface VimSession {
  file: string | null;
}

/** What a line typed inside the fake vim prints, and whether it leaves vim. */
export interface VimOutput {
  lines: string[];
  type?: 'output' | 'error';
  leave?: boolean;
}

export interface CommandContext {
  /** Every command entered this session, oldest first, including the one being run. */
  history: string[];
  /** Random number in [0, 1); injectable so `fortune` is testable. */
  random?: () => number;
}

/**
 * The widest a line of console output that is laid out in columns should be. The console wraps
 * longer lines (`whitespace-pre-wrap`), but wrapped columns look broken. The floating console's
 * output area is about 44 monospace columns wide on a 375 px phone (less with a scrollbar).
 */
export const COLUMN_BUDGET = 42;

/** What `help` prints. */
export const HELP_LINES = [
  'Available commands:',
  '  ls              — list this directory',
  '  ls projects     — list all projects',
  '  ls posts        — list all blog posts',
  '  pwd             — show working directory',
  '  cd <dir>        — change directory',
  '  open <id>       — open a project or post',
  '  open .          — open this directory',
  '  whoami          — about jordan',
  '  contact         — contact info',
  '  clear           — clear console',
  '  vim [file]      — edit a file, bravely',
  '  pet koda        — say hi to koda',
  '  man jordan      — the manual page',
  '  history         — commands so far',
  '  shortcuts       — keyboard shortcuts',
  '  exit            — close the console',
  '  (Tab completes; Esc closes)',
  '  (a few more are hiding in here)',
];

/** Tab-completable names of the commands in this module that `help` lists. Hidden ones stay hidden. */
export const EXTRA_COMPLETIONS = ['vim', 'pet koda', 'man jordan', 'history', 'shortcuts', 'exit'];

/** What `whoami` and `contact` print. `man jordan` may only say what these already say. */
export const WHOAMI_LINES = [
  'jordan christensen',
  'iOS Developer from Utah. I love tinkering and going on hikes with my pup named Koda.',
  'Currently: building TrekPoint, writing too much QMK firmware.',
  'Previously: building this portfolio website.',
];

export const CONTACT_LINES = ['Email:   jordan.c4922@gmail.com', 'GitHub:  github.com/mazjap'];

/** Hard-wrapped to COLUMN_BUDGET. Says only what `WHOAMI_LINES` already says. */
export const MAN_JORDAN = [
  'JORDAN(1)     User Commands     JORDAN(1)',
  '',
  'NAME',
  '    jordan - iOS developer from Utah',
  '',
  'SYNOPSIS',
  '    jordan [--tinker] [--hike]',
  '',
  'DESCRIPTION',
  '    Jordan Christensen is an iOS',
  '    Developer from Utah who loves',
  '    tinkering and going on hikes with',
  '    a pup named Koda.',
  '',
  '    Currently: building TrekPoint,',
  '    writing too much QMK firmware.',
  '    Previously: building this',
  '    portfolio website.',
  '',
  'SEE ALSO',
  '    contact(1), whoami(1)',
];

const PET_KODA = ['🐕 Koda wags happily and leans into it.', 'Good pup.'];

export const VIM_LEAVE_MESSAGE = 'vim: nothing was saved. Back to zsh.';

/** What entering vim looks like: an empty buffer and a status line. */
function enterVim(args: string[]): CommandOutput {
  const file = args.find(a => !a.startsWith('-')) ?? null;
  return { lines: ['~', '~', '~', `"${file ?? '[No Name]'}" 0L, 0B`], vim: { file } };
}

const VIM_QUIT = /^(q|quit|wq|x|xit|exit|qa|qall|quita|quitall|wqa|wqall|xa|xall)$/;
const VIM_FORCE_QUIT = /^(q|quit|qa|qall|quita|quitall|cq|wq|x|xit|exit|xa|wqa)!$/;

/**
 * A line typed while the console is "in vim". The prompt is `:`, so a leading colon is optional.
 * `:q`, `:wq`, and friends refuse (E37) and stay; `:q!` leaves. Escape also leaves, but that's the
 * console's key handler. Everything else gets the error vim would give.
 */
export function runVimLine(raw: string, session: VimSession): VimOutput {
  const ex = raw.trim().replace(/^:+/, '').trim();
  const [name = '', ...args] = ex.split(/\s+/);
  if (VIM_FORCE_QUIT.test(name)) return { lines: [VIM_LEAVE_MESSAGE], leave: true };
  if (VIM_QUIT.test(name)) return { lines: ['E37: No write since last change (add ! to override)'], type: 'error' };
  if (name === 'w' || name === 'write') {
    const target = args[0] ?? session.file;
    return target ? { lines: [`"${target}" [New] 0L, 0B written`] } : { lines: ['E32: No file name'], type: 'error' };
  }
  if (name === 'set' || name === 'se' || name === 'syntax' || name === '') return { lines: [] };
  if (name === 'h' || name === 'help') return { lines: [`E149: Sorry, no help for ${args[0] ?? 'help.txt'}`], type: 'error' };
  return { lines: [`E492: Not an editor command: ${ex}`], type: 'error' };
}

const FORTUNES = [
  'It works on my machine. Ship the machine.',
  'There are two hard problems: naming things, cache invalidation, and off-by-one errors.',
  'A SwiftUI view is a function of its state. A developer is a function of coffee.',
  'Your next build will succeed. Probably. Try cleaning first.',
  'Nothing is as permanent as a TODO comment.',
  'Take the dog on a hike. The bug will still be there, but you will see it differently.',
  'Always read the error message. Then read it again. It was telling the truth the first time.',
  'Some old codes still work: ↑ ↑ ↓ ↓ ← → ← → B A.',
];

const ok = (...lines: string[]): CommandOutput => ({ lines });
const fail = (...lines: string[]): CommandOutput => ({ lines, type: 'error' });

function git(args: string[]): CommandOutput {
  switch (args[0]) {
    case 'status':
      return ok(
        'On branch main',
        "Your branch is up to date with 'origin/main'.",
        '',
        'nothing to commit, working tree clean',
      );
    case 'log':
      return ok(
        'commit c0ffee1 (HEAD -> main, origin/main)',
        'Author: Jordan Christensen',
        '',
        '    Add more Easter eggs',
        '',
        'commit 0ddba11',
        'Author: Jordan Christensen',
        '',
        '    Pet Koda',
      );
    case 'push':
      return fail(
        "error: failed to push some refs to 'jordan-christensen.com'",
        'hint: This site is read-only here. If you have an idea, try `contact`.',
      );
    default:
      return fail(args[0] ? `git: '${args[0]}' is not something this tiny terminal can do.` : 'usage: git <command>', 'Try `git status` or `git log`.');
  }
}

function xcodebuild(args: string[]): CommandOutput {
  // Flags take values (`-scheme Portfolio`), so look for an action word anywhere rather than the first bare word.
  const action = args.find(a => a === 'clean' || a === 'test' || a === 'archive');
  const result = action ? action.toUpperCase() : 'BUILD';
  return ok(
    'Command line invocation:',
    '    xcodebuild' + (args.length ? ` ${args.join(' ')}` : ''),
    '',
    'note: building a website with a tool made for apps.',
    'warning: Koda has not been walked yet.',
    '',
    `** ${result} SUCCEEDED **`,
  );
}

/**
 * The console's extra commands: the real ones that don't need the console's state (`history`,
 * `shortcuts`, `exit`) and the hidden jokes. Returns null for anything else, so the caller can print
 * "command not found". Whitespace is collapsed first, and names are case-sensitive, like a shell.
 */
export function runExtraCommand(raw: string, ctx: CommandContext): CommandOutput | null {
  const cmd = raw.trim().replace(/\s+/g, ' ');
  const [name, ...args] = cmd.split(' ');

  // Checked first, ahead of the generic `sudo` and `rm` jokes below.
  if (/^(sudo )?rm -rf [/~*]/.test(cmd)) return fail('nice try.');
  if (cmd === 'sudo make me a sandwich') return ok('Okay.');
  if (cmd === 'make me a sandwich') return fail('What? Make it yourself.');

  switch (name) {
    case 'history':
      return ok(...ctx.history.map((c, i) => `${String(i + 1).padStart(5)}  ${c}`));
    case 'shortcuts':
      return ok(
        'Keyboard shortcuts (Mac):',
        ...SHORTCUTS.map(s => `  ${s.keys.padEnd(5)} — ${s.name}`),
        '  (⌘R is left alone for reloading)',
      );
    case 'exit':
    case 'logout':
      return { lines: ['logout', '', '[Process completed]'], exit: true };
    case 'sudo':
      return fail('visitor is not in the sudoers file. This incident will be reported to Koda.');
    case 'rm':
      return fail('rm: this portfolio is read-only. Nothing was deleted.');
    case 'git':
      return git(args);
    case 'xcodebuild':
      return xcodebuild(args);
    case 'make':
      if (args[0] === 'coffee') return fail("make: *** No rule to make target 'coffee'.  Stop.", "HTTP 418: I'm a teapot.");
      return fail(
        args[0] ? `make: *** No rule to make target '${args[0]}'.  Stop.` : 'make: *** No targets specified and no makefile found.  Stop.',
      );
    case 'vim':
    case 'vi':
    case 'nvim':
      return enterVim(args);
    case 'pet':
      if (args[0] === 'koda') return ok(...PET_KODA);
      return fail(args[0] ? `pet: ${args[0]}: No such pet. Try \`pet koda\`.` : 'pet: pet what? Try `pet koda`.');
    case 'man':
      if (!args[0]) return ok('What manual page do you want?');
      return args[0] === 'jordan' && args.length === 1 ? ok(...MAN_JORDAN) : fail(`No manual entry for ${args.join(' ')}`);
    case 'emacs':
      return ok('Starting emacs… this may take a few years. Try vim instead.');
    case 'nano':
      return ok('nano: a perfectly reasonable choice. Sadly, not installed.');
    case 'fortune':
      return ok(FORTUNES[Math.floor((ctx.random ?? Math.random)() * FORTUNES.length)] ?? FORTUNES[0]);
    case 'koda':
      return ok(...PET_KODA);
    default:
      return null;
  }
}
