import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Line {
  type: 'input' | 'output' | 'error';
  text: string;
}

type ConsoleMode = 'float' | 'minimized' | 'fullscreen';

const HOME_PATH = '/Users/Jordan/Developer/definitely-final-portfolio-v3-REAL';

const CONSOLE_NAV_KEY = 'console-nav-cache';
const CONSOLE_NAV_TTL = 24 * 60 * 60 * 1000;

interface NavCacheData {
  projectIds: string[];
  postIds: string[];
  ts: number;
}

function loadNavCache(): NavCacheData | null {
  try {
    const raw = localStorage.getItem(CONSOLE_NAV_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as NavCacheData;
    if (Date.now() - data.ts > CONSOLE_NAV_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveNavCache(projectIds: string[], postIds: string[]): void {
  try {
    localStorage.setItem(CONSOLE_NAV_KEY, JSON.stringify({ projectIds, postIds, ts: Date.now() }));
  } catch {}
}

function getTabCandidates(input: string, cwd: string, projectIds: string[], postIds: string[]): string[] {
  if (!input) {
    return ['help', 'ls', 'pwd', 'cd', 'open', 'whoami', 'contact', 'clear'];
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
  const cmds = ['help', 'ls', 'ls projects', 'ls posts', 'pwd', 'cd projects', 'cd posts', 'cd ..', 'open .', 'open', 'whoami', 'contact', 'clear'];
  return cmds.filter(c => c.startsWith(input) && c !== input);
}

export default function Console() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ConsoleMode>('float');
  const [cwd, setCwd] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [postIds, setPostIds] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([{ type: 'output', text: 'Type "help" for available commands.' }]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch and cache nav IDs (24-hour TTL)
  useEffect(() => {
    const cached = loadNavCache();
    if (cached) {
      setProjectIds(cached.projectIds);
      setPostIds(cached.postIds);
      return;
    }
    Promise.all([
      fetch('/api/projects/nav').then(r => r.ok ? r.json() : []),
      fetch('/api/posts/nav').then(r => r.ok ? r.json() : []),
    ]).then(([projects, posts]) => {
      const pIds = (projects as Array<{ id: string }>).map(p => p.id);
      const bIds = (posts as Array<{ id: string }>).map(p => p.id);
      setProjectIds(pIds);
      setPostIds(bIds);
      saveNavCache(pIds, bIds);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    if (open && mode !== 'minimized') inputRef.current?.focus();
  }, [open, mode]);

  const push = useCallback((text: string, type: Line['type'] = 'output') => {
    setLines(prev => [...prev, { type, text }]);
  }, []);

  const run = useCallback((raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    setLines(prev => [...prev, { type: 'input', text: `> ${cmd}` }]);
    setHistory(h => [cmd, ...h]);
    setHistoryIdx(-1);
    setInput('');

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
      push('jordan christensen');
      push('iOS Developer from Utah. I love tinkering and going on hikes with my pup named Koda.');
      push('Currently: building TrekPoint, writing too much QMK firmware.');
      push('Previously: building this portfolio website.');
    }
    // contact
    else if (cmd === 'contact') {
      push('Email:   jordan.c4922@gmail.com');
      push('GitHub:  github.com/mazjap');
    }
    // help
    else if (cmd === 'help') {
      push('Available commands:');
      push('  ls                  — list directories or contents');
      push('  ls projects         — list all projects');
      push('  ls posts            — list all blog posts');
      push('  pwd                 — print working directory');
      push('  cd <dir>            — change directory (projects, posts, ..)');
      push('  open <id>           — navigate to a project or post');
      push('  open .              — open current directory');
      push('  whoami              — about jordan christensen');
      push('  contact             — contact info');
      push('  clear               — clear console');
    }
    // clear
    else if (cmd === 'clear') {
      setLines([]);
    }
    // easter egg
    else if (/^(sudo\s+)?rm\s+-rf\s+[/~*]/.test(cmd)) {
      push('nice try.', 'error');
    }
    // unknown
    else {
      push(`zsh: command not found: ${cmd}`, 'error');
    }
  }, [push, navigate, cwd, projectIds, postIds]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      run(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(idx);
      setInput(history[idx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx);
      setInput(idx === -1 ? '' : history[idx]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const candidates = getTabCandidates(input, cwd, projectIds, postIds);
      if (candidates.length === 1) {
        setInput(candidates[0]);
      } else if (candidates.length > 1) {
        push(candidates.join('    '));
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
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

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-9 h-9 rounded-lg bg-xcode-surface dark:bg-xcode-surface border border-xcode-border-light dark:border-xcode-border flex items-center justify-center text-xcode-muted hover:text-xcode-accent hover:border-xcode-accent transition-all shadow-lg font-mono text-xs"
        title="Open console"
        aria-label="Toggle developer console"
      >
        &gt;_
      </button>

      {open && (
        <div className={`overflow-hidden shadow-2xl border border-xcode-border-light dark:border-xcode-border ${positionCls}`}>
          <div className="bg-xcode-sidebar-light dark:bg-xcode-sidebar px-3 py-2 flex items-center gap-2 border-b border-xcode-border-light dark:border-xcode-border select-none">
            <div className="flex gap-1.5">
              <button
                onClick={() => setOpen(false)}
                className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#ff3b30] transition-colors focus:outline-none"
                aria-label="Close"
              />
              <button
                onClick={() => setOpen(false)}
                className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:bg-[#FFB340] transition-colors focus:outline-none"
                aria-label="Dismiss"
              />
              <button
                onClick={() => setMode(m => m === 'fullscreen' ? 'float' : 'fullscreen')}
                className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#34c759] transition-colors focus:outline-none"
                aria-label={mode === 'fullscreen' ? 'Exit fullscreen' : 'Fullscreen'}
              />
            </div>
            <span className="text-xs font-mono text-xcode-muted ml-2">Terminal — zsh</span>
          </div>

          {mode !== 'minimized' && (
            <>
              <div
                className={`bg-[#1d1f21] ${outputHeightCls} overflow-y-auto p-3 font-mono text-xs leading-5 cursor-text`}
                onClick={handleOutputClick}
              >
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.type === 'input'
                        ? 'text-xcode-accent'
                        : line.type === 'error'
                        ? 'text-xcode-red'
                        : 'text-xcode-text'
                    }
                  >
                    {line.text || <span>&nbsp;</span>}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="bg-[#1d1f21] border-t border-xcode-border flex items-center px-3 py-2 gap-2">
                <span className="font-mono text-xs text-xcode-green flex-shrink-0 whitespace-nowrap">
                  {promptPath}&nbsp;$
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
            </>
          )}
        </div>
      )}
    </>
  );
}
