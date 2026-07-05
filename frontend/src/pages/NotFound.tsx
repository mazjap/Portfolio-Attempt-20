import { useLocation, useNavigate } from 'react-router-dom';

const K = {
  keyword: '#FC5FA3',
  type:    '#5DD8FF',
  func:    '#67B7A4',
  str:     '#FC6A5D',
  attr:    '#BF8F4D',
  plain:   '#D4D4D4',
  muted:   '#636366',
  comment: '#6B8A4E',
};

interface LineProps {
  num: number;
  indent?: number;
  children?: React.ReactNode;
  highlight?: boolean;
  gutterIcon?: React.ReactNode;
}

function Line({ num, indent = 0, children, highlight, gutterIcon }: LineProps) {
  return (
    <div className={`flex items-baseline min-h-[1.5rem] ${highlight ? 'bg-red-500/[0.12]' : ''}`}>
      <span
        className="select-none text-right flex-shrink-0 pr-3 pl-4"
        style={{ color: K.muted, width: '3rem', fontSize: '11px', lineHeight: '1.5rem' }}
      >
        {num}
      </span>
      <span className="flex-shrink-0 w-5 text-center" style={{ fontSize: '11px', lineHeight: '1.5rem' }}>
        {gutterIcon}
      </span>
      <span
        className="pr-6 font-mono"
        style={{ paddingLeft: `${indent * 20}px`, fontSize: '13px', lineHeight: '1.5rem', color: K.plain }}
      >
        {children}
      </span>
    </div>
  );
}

function kw(s: string) { return <span style={{ color: K.keyword }}>{s}</span>; }
function ty(s: string) { return <span style={{ color: K.type }}>{s}</span>; }
function fn(s: string) { return <span style={{ color: K.func }}>{s}</span>; }
function co(s: string) { return <span style={{ color: K.comment }}>{s}</span>; }

export default function NotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? 'undefined';
  const suggestion = segments[0] === 'projects' ? 'projects'
    : segments[0] === 'blog' ? 'blog'
    : 'projects';
  const parent = segments.slice(0, -1).join('/');
  const displayPath = parent ? `/${parent}/` : '/';

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* Xcode editor window */}
        <div className="rounded-xl overflow-hidden border border-xcode-border-light dark:border-xcode-border shadow-2xl">

          {/* Traffic light title bar */}
          <div
            className="flex items-center gap-2 px-4 border-b border-xcode-border-light dark:border-xcode-border select-none"
            style={{ background: '#2D2D2D', height: '36px' }}
          >
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#FEBC2E' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
            </div>
            <span className="font-mono text-[11px] mx-auto" style={{ color: K.muted }}>
              AppRouter.swift — 1 error
            </span>
          </div>

          {/* Code lines */}
          <div style={{ background: '#1E1E1E' }} className="py-2">
            <Line num={1}>{kw('import')} {ty('SwiftUI')}</Line>
            <Line num={2} />
            <Line num={3}>{kw('struct')} {ty('AppRouter')} {'{'}</Line>
            <Line num={4} indent={1}>
              {kw('static func')} {fn('resolve')}{kw('(')}
              <span style={{ color: K.attr }}>_</span> path: {ty('String')}
              {')'} {'->'} {ty('AnyView')} {'{'}
            </Line>
            <Line num={5} indent={2}>{kw('switch')} path {'{'}</Line>
            <Line num={6} indent={3}>
              {kw('case')} <span style={{ color: K.str }}>"/"</span>:{' '}
              {fn('HomeView')}().{fn('eraseToAnyView')}()
            </Line>
            <Line num={7} indent={3}>
              {kw('case')} <span style={{ color: K.str }}>"/projects"</span>:{' '}
              {fn('ProjectsView')}().{fn('eraseToAnyView')}()
            </Line>
            <Line num={8} indent={3}>
              {kw('case')} <span style={{ color: K.str }}>"/blog"</span>:{' '}
              {fn('BlogView')}().{fn('eraseToAnyView')}()
            </Line>

            {/* Error line */}
            <Line
              num={9}
              indent={3}
              highlight
              gutterIcon={
                <span style={{ color: '#FF3B30', fontSize: '12px', fontWeight: 700 }}>●</span>
              }
            >
              {kw('case')}{' '}
              <span style={{ color: K.str }}>
                "{displayPath}
                <span className="squiggle">{lastSegment}</span>
                "
              </span>
              :{' '}
              <span style={{ color: K.attr }}>???</span>
            </Line>

            {/* Inline error message */}
            <div
              className="flex items-start gap-2 py-1 border-l-2"
              style={{
                paddingLeft: '4.75rem',
                background: 'rgba(255, 59, 48, 0.06)',
                borderColor: '#FF3B30',
              }}
            >
              <span style={{ color: '#FF3B30', fontSize: '12px', flexShrink: 0 }}>⛔</span>
              <span className="font-mono text-xs" style={{ color: '#FF6B6B' }}>
                Cannot find{' '}
                <span style={{ color: '#FF9F9F' }}>'{lastSegment}'</span>
                {' '}in scope
              </span>
            </div>

            {/* Suggestion */}
            <div
              className="flex items-start gap-2 py-1 mb-1"
              style={{ paddingLeft: '4.75rem', background: 'rgba(78,184,250,0.04)' }}
            >
              <span style={{ color: '#4EB8FA', fontSize: '12px', flexShrink: 0 }}>◈</span>
              <span className="font-mono text-xs" style={{ color: K.muted }}>
                Did you mean{' '}
                <span style={{ color: '#4EB8FA' }}>'/{suggestion}'</span>?
              </span>
            </div>

            <Line num={10} indent={2}>{co('// default: fatalError("route not found")')}</Line>
            <Line num={11} indent={2}>{'}'}</Line>
            <Line num={12} indent={1}>{'}'}</Line>
            <Line num={13}>{'}'}</Line>
          </div>
        </div>

        {/* Fix button */}
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={() => navigate(`/${suggestion}`)}
            className="font-mono text-sm px-5 py-1.5 rounded-md transition-colors"
            style={{
              background: '#4EB8FA',
              color: '#1C1C1E',
              fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            fix
          </button>
          <span className="font-mono text-xs" style={{ color: K.muted }}>
            → navigate to{' '}
            <span style={{ color: '#4EB8FA' }}>/{suggestion}</span>
          </span>
        </div>

      </div>
    </div>
  );
}
