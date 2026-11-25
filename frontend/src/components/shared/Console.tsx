import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectNav } from '../../hooks/useProjects';
import { usePostNav } from '../../hooks/usePosts';
import { prefersReducedMotion } from '../../lib/motion';
import {
  CONTACT_LINES,
  EXTRA_COMPLETIONS,
  HELP_LINES,
  VIM_LEAVE_MESSAGE,
  WHOAMI_LINES,
  runExtraCommand,
  runVimLine,
  type VimSession,
} from '../../lib/consoleCommands';

interface Line {
  type: 'input' | 'output' | 'error';
  text: string;
}

type ConsoleMode = 'float' | 'fullscreen';

const HOME_PATH = '/Users/Jordan/Developer/definitely-final-portfolio-v3-REAL';

function getTabCandidates(input: string, cwd: string, projectIds: string[], postIds: string[]): string[] {
  if (!input) {
    return ['help', 'ls', 'pwd', 'cd', 'open', 'whoami', 'contact', 'clear', ...EXTRA_COMPLETIONS];
  }
  if (input.startsWith('cd ')) {
    const partial = input.slice(3);
    const dirs = cwd === ''
      ? ['projects', 'posts']
      : cwd === 'projects'
      ? [...projectIds, '..']
      : cwd === 'posts'
      ? [...postIds, '..']
      : ['..'];
    return dirs.filter(d => d.startsWith(partial)).map(d => `cd ${d}`);
  }
  if (input.startsWith('open ')) {
    const partial = input.slice(5);
    return [...projectIds, ...postIds, '.'].filter(id => id.startsWith(partial) && id !== input.slice(5)).map(id => `open ${id}`);
  }
  const cmds = ['help', 'ls', 'ls projects', 'ls posts', 'pwd', 'cd projects', 'cd posts', 'cd ..', 'open .', 'open', 'whoami', 'contact', 'clear', ...EXTRA_COMPLETIONS];
  return cmds.filter(c => c.startsWith(input) && c !== input);
}

export default function Console() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ConsoleMode>('float');
  const [cwd, setCwd] = useState('');
  // Set while the fake vim (`vim`) has the console: lines typed are vim commands until it's left.
  const [vim, setVim] = useState<VimSession | null>(null);
  // The same cached nav lists the sidebar uses; nothing is fetched until the console is opened.
  const { nav: projectNav } = useProjectNav({ enabled: open });
  const { nav: postNav } = usePostNav({ enabled: open });
  const projectIds = (projectNav ?? []).map(p => p.id);
  const postIds = (postNav ?? []).map(p => p.id);
  const [lines, setLines] = useState<Line[]>([{ type: 'output', text: 'Type "help" for available commands.' }]);
  const [input, setInput] = useState('');
  // Shell history (what `history` lists). Lines typed inside vim are kept apart, so `history` stays a shell's.
  const [history, setHistory] = useState<string[]>([]);
  const [vimHistory, setVimHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [lines]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, mode]);

  /** Closes the console and puts focus back on the button that opens it. */
  const close = useCallback(() => {
    setOpen(false);
    setVim(null);
    setVimHistory([]);
    toggleRef.current?.focus();
  }, []);

  const push = useCallback((text: string, type: Line['type'] = 'output') => {
    setLines(prev => [...prev, { type, text }]);
  }, []);

  const run = useCallback((raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    // In vim, every line is a vim command, except `clear`, which stays a way out.
    const inVim = vim !== null && cmd !== 'clear';
    setLines(prev => [...prev, { type: 'input', text: inVim ? `:${cmd.replace(/^:+/, '')}` : `> ${cmd}` }]);
    if (inVim) setVimHistory(h => [cmd, ...h]);
    else setHistory(h => [cmd, ...h]);
    setHistoryIdx(-1);
    setInput('');

    if (inVim) {
      const out = runVimLine(cmd, vim);
      out.lines.forEach(line => push(line, out.type));
      if (out.leave) {
        setVim(null);
        setVimHistory([]);
      }
      return;
    }

    // ls
    if (cmd === 'ls') {
      if (cwd === '') {
        push('projects');
        push('posts');
      } else if (cwd === 'projects') {
        projectIds.forEach(id => push(id));
      } else if (cwd === 'posts') {
        postIds.forEach(id => push(id));
      } else {
        push(cwd.split('/').pop() ?? cwd);
      }
    }
    else if (cmd === 'ls projects') {
      projectIds.forEach(id => push(id));
    } else if (cmd === 'ls posts') {
      postIds.forEach(id => push(id));
    }
    // pwd
    else if (cmd === 'pwd') {
      push(cwd ? `${HOME_PATH}/${cwd}` : HOME_PATH);
    }
    // cd
    else if (cmd === 'cd' || cmd === 'cd ~') {
      setCwd('');
    } else if (cmd === 'cd /') {
      push('cd: /: Permission denied', 'error');
    } else if (cmd === 'cd ..') {
      if (cwd === '') {
        push('cd: ..: Already at home directory', 'error');
      } else {
        const parts = cwd.split('/');
        parts.pop();
        setCwd(parts.join('/'));
      }
    } else if (cmd.startsWith('cd ')) {
      const target = cmd.slice(3).trim();
      if (target.startsWith('/')) {
        push(`cd: ${target}: Permission denied`, 'error');
      } else if (cwd === '') {
        if (target === 'projects' || target === 'posts') {
          setCwd(target);
        } else {
          push(`cd: ${target}: No such file or directory`, 'error');
        }
      } else if (cwd === 'projects') {
        if (projectIds.includes(target)) {
          setCwd(`projects/${target}`);
        } else if (target === '..') {
          setCwd('');
        } else {
          push(`cd: ${target}: No such file or directory`, 'error');
        }
      } else if (cwd === 'posts') {
        if (postIds.includes(target)) {
          setCwd(`posts/${target}`);
        } else if (target === '..') {
          setCwd('');
        } else {
          push(`cd: ${target}: No such file or directory`, 'error');
        }
      } else {
        if (target === '..') {
          const parts = cwd.split('/');
          parts.pop();
          setCwd(parts.join('/'));
        } else {
          push(`cd: ${target}: No such file or directory`, 'error');
        }
      }
    }
    // open
    else if (cmd === 'open .') {
      if (cwd === 'projects') {
        push('Opening projects...');
        navigate('/projects');
        setOpen(false);
      } else if (cwd === 'posts') {
        push('Opening blog...');
        navigate('/blog');
        setOpen(false);
      } else if (cwd.startsWith('projects/')) {
        const id = cwd.slice('projects/'.length);
        push(`Opening project: ${id}`);
        navigate(`/projects/${id}`);
        setOpen(false);
      } else if (cwd.startsWith('posts/')) {
        const id = cwd.slice('posts/'.length);
        push(`Opening post: ${id}`);
        navigate(`/blog/${id}`);
        setOpen(false);
      } else {
        push('open: .: Nothing to open here', 'error');
      }
    } else if (cmd.startsWith('open ')) {
      const id = cmd.slice(5).trim();
      if (projectIds.includes(id)) {
        push(`Opening project: ${id}`);
        navigate(`/projects/${id}`);
        setOpen(false);
      } else if (postIds.includes(id)) {
        push(`Opening post: ${id}`);
        navigate(`/blog/${id}`);
        setOpen(false);
      } else {
        push(`open: ${id}: No such project or post`, 'error');
      }
    }
    // whoami
    else if (cmd === 'whoami') {
      WHOAMI_LINES.forEach(line => push(line));
    }
    // contact
    else if (cmd === 'contact') {
      CONTACT_LINES.forEach(line => push(line));
    }
    // help
    else if (cmd === 'help') {
      HELP_LINES.forEach(line => push(line));
    }
    // clear
    else if (cmd === 'clear') {
      setLines([]);
      setVim(null);
      setVimHistory([]);
    }
    // history, shortcuts, exit, and the hidden jokes (src/lib/consoleCommands.ts)
    else {
      const extra = runExtraCommand(cmd, { history: [...history].reverse().concat(cmd) });
      if (!extra) {
        push(`zsh: command not found: ${cmd}`, 'error');
      } else {
        extra.lines.forEach(line => push(line, extra.type));
        if (extra.vim) setVim(extra.vim);
        if (extra.exit) close();
      }
    }
  }, [push, close, navigate, cwd, history, vim, projectIds, postIds]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      // `exit` moves focus to the toggle button: without this, the same Enter would then press it and reopen the console.
      e.preventDefault();
      run(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const recall = vim ? vimHistory : history;
      const idx = Math.min(historyIdx + 1, recall.length - 1);
      setHistoryIdx(idx);
      setInput(recall[idx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx);
      setInput(idx === -1 ? '' : (vim ? vimHistory : history)[idx]);
    } else if (e.key === 'Tab' && !e.shiftKey && input !== '' && !vim) {
      // Completion only with something typed: Shift+Tab, or Tab on an empty line, moves focus as usual.
      e.preventDefault();
      const candidates = getTabCandidates(input, cwd, projectIds, postIds);
      if (candidates.length === 1) {
        setInput(candidates[0]);
      } else if (candidates.length > 1) {
        push(candidates.join('    '));
      }
    } else if (e.key === 'Escape') {
      if (vim) {
        // Escape gets out of vim, not out of the console.
        setVim(null);
        setVimHistory([]);
        setHistoryIdx(-1);
        setInput('');
        push(VIM_LEAVE_MESSAGE);
      } else {
        close();
      }
    }
  }

  function handleOutputClick(e: React.MouseEvent) {
    if (!window.getSelection()?.toString()) {
      e.preventDefault();
      inputRef.current?.focus();
    }
  }

  const promptPath = cwd ? `~/${cwd}` : '~';

  const positionCls = mode === 'fullscreen'
    ? 'fixed bottom-0 left-0 right-0 z-50 rounded-t-xl rounded-b-none animate-slide-up'
    : 'fixed bottom-16 right-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] rounded-xl animate-slide-up';

  const outputHeightCls = mode === 'fullscreen' ? 'h-[40vh]' : 'h-64';
  const trafficLightCls = 'w-3 h-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-xcode-accent';

  return (
    <>
      <button
        ref={toggleRef}
        onClick={() => {
          if (open) {
            setVim(null);
            setVimHistory([]);
          }
          setOpen(o => !o);
        }}
        className="xcode-dark-tokens fixed bottom-4 right-4 z-50 w-9 h-9 rounded-lg bg-xcode-surface dark:bg-xcode-surface border border-xcode-border-light dark:border-xcode-border flex items-center justify-center text-xcode-muted hover:text-xcode-accent hover:border-xcode-accent transition-all shadow-lg font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcode-accent"
        title="Open console"
        aria-label="Developer console"
        aria-expanded={open}
        aria-controls="developer-console"
      >
        &gt;_
      </button>

      {open && (
        <div
          id="developer-console"
          role="dialog"
          aria-label="Developer console"
          className={`xcode-dark-tokens overflow-hidden shadow-2xl border border-xcode-border-light dark:border-xcode-border ${positionCls}`}
        >
          <div className="bg-xcode-sidebar-light dark:bg-xcode-sidebar px-3 py-2 flex items-center gap-2 border-b border-xcode-border-light dark:border-xcode-border select-none">
            <div className="flex gap-1.5">
              <button
                onClick={close}
                className={`${trafficLightCls} bg-[#FF5F57] hover:bg-[#ff3b30]`}
                aria-label="Close console"
              />
              <button
                onClick={close}
                className={`${trafficLightCls} bg-[#FEBC2E] hover:bg-[#FFB340]`}
                aria-label="Minimize console"
              />
              <button
                onClick={() => setMode(m => m === 'fullscreen' ? 'float' : 'fullscreen')}
                className={`${trafficLightCls} bg-[#28C840] hover:bg-[#34c759]`}
                aria-label={mode === 'fullscreen' ? 'Exit full width' : 'Full width'}
                aria-pressed={mode === 'fullscreen'}
              />
            </div>
            <span className="text-xs font-mono text-xcode-muted ml-2">Terminal — {vim ? 'vim' : 'zsh'}</span>
          </div>

          <div
            className={`bg-[#1d1f21] ${outputHeightCls} overflow-y-auto p-3 font-mono text-xs leading-5 cursor-text`}
            onClick={handleOutputClick}
            role="log"
            aria-live="polite"
          >
            {lines.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap break-words ${
                  line.type === 'input'
                    ? 'text-xcode-accent'
                    : line.type === 'error'
                    ? 'text-xcode-red'
                    : 'text-xcode-text'
                }`}
              >
                {line.text || <span>&nbsp;</span>}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="bg-[#1d1f21] border-t border-xcode-border flex items-center px-3 py-2 gap-2 focus-within:ring-1 focus-within:ring-inset focus-within:ring-xcode-accent/60">
            <span className="font-mono text-xs text-xcode-green flex-shrink-0 whitespace-nowrap">
              {vim ? ':' : <>{promptPath}&nbsp;$</>}
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              className="flex-1 bg-transparent font-mono text-xs text-xcode-text outline-none caret-xcode-accent min-w-0"
              spellCheck={false}
              autoComplete="off"
              aria-label="Console input"
            />
          </div>
        </div>
      )}
    </>
  );
}
