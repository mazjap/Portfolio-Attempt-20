import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';

type BuildState = null | 'building' | 'success';
type RunState = null | 'running';
type CleanState = null | 'cleaning' | 'done';

export default function Navbar() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [build, setBuild] = useState<BuildState>(null);
  const [run, setRun] = useState<RunState>(null);
  const [clean, setClean] = useState<CleanState>(null);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!e.metaKey) return;
      if (!e.shiftKey && e.key === 'b') {
        e.preventDefault();
        setBuild('building');
        setTimeout(() => setBuild('success'), 900);
        setTimeout(() => setBuild(null), 3500);
      }
      if (!e.shiftKey && e.key === 'r') {
        e.preventDefault();
        setRun('running');
        setTimeout(() => setRun(null), 3000);
      }
      if (e.shiftKey && e.key === 'K') {
        e.preventDefault();
        setClean('cleaning');
        setTimeout(() => setClean('done'), 700);
        setTimeout(() => setClean(null), 2500);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toast = (() => {
    if (build === 'building') return { text: '⟳  Building…', cls: 'text-xcode-yellow' };
    if (build === 'success') return { text: '✓  Build Succeeded', cls: 'text-xcode-green' };
    if (run === 'running') return { text: '▶  Running on iPhone 16 Pro Simulator…', cls: 'text-xcode-teal' };
    if (clean === 'cleaning') return { text: 'Clean Build Folder…', cls: 'text-xcode-muted' };
    if (clean === 'done') return { text: 'Clean Build Folder… Done.', cls: 'text-xcode-muted' };
    return null;
  })();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${
      isActive
        ? 'text-xcode-accent'
        : 'text-xcode-muted hover:text-xcode-text-light dark:hover:text-xcode-text'
    }`;

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-xcode-border-light dark:border-xcode-border bg-xcode-bg-light/90 dark:bg-xcode-bg/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-12 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Link
            to="/"
            className="font-mono text-sm font-medium text-xcode-text-light dark:text-xcode-text hover:text-xcode-accent transition-colors"
          >
            jordan christensen
          </Link>

          <div className="flex items-center gap-6">
            <NavLink to="/projects" className={linkCls}>Projects</NavLink>
            <NavLink to="/blog" className={linkCls}>Blog</NavLink>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={toggleDark}
              className="w-8 h-8 rounded-md flex items-center justify-center text-xcode-muted hover:text-xcode-accent hover:bg-xcode-surface-light dark:hover:bg-xcode-surface transition-all"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-2 rounded-lg px-4 py-2 bg-xcode-sidebar-light dark:bg-xcode-sidebar border border-xcode-border-light dark:border-xcode-border shadow-xl">
            <span className={`font-mono text-sm ${toast.cls}`}>{toast.text}</span>
            {build === 'success' && (
              <span className="font-mono text-xs text-xcode-muted">
                {new Date().toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
