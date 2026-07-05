interface Props {
  context?: 'projects' | 'posts' | 'general';
}

const STACKS: Record<NonNullable<Props['context']>, string[]> = {
  projects: [
    '0   libnode.dylib                 0x00000001043f2a10  brew() + 42',
    '1   libnode.dylib                 0x00000001043f1337  makeCoffee() + 128',
    '2   portfolio-server              0x000000010440beef  getProjects() + 16',
    '3   portfolio-server              0x0000000104410000  handleRequest() + 256',
    '4   portfolio-server              0x0000000104411a34  express::Router::handle() + 512',
  ],
  posts: [
    '0   libnode.dylib                 0x00000001043f2a10  brew() + 42',
    '1   libnode.dylib                 0x00000001043f1337  makeCoffee() + 128',
    '2   portfolio-server              0x000000010440cafe  getPosts() + 16',
    '3   portfolio-server              0x0000000104410000  handleRequest() + 256',
    '4   portfolio-server              0x0000000104411a34  express::Router::handle() + 512',
  ],
  general: [
    '0   libnode.dylib                 0x00000001043f2a10  brew() + 42',
    '1   libnode.dylib                 0x00000001043f1337  makeCoffee() + 128',
    '2   portfolio-server              0x000000010440beef  initialize() + 16',
    '3   portfolio-server              0x0000000104410000  handleRequest() + 256',
    '4   portfolio-server              0x0000000104411a34  express::Router::handle() + 512',
  ],
};

function now(): string {
  return new Date().toLocaleString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZoneName: 'short',
  });
}

export default function CrashReport({ context = 'general' }: Props) {
  const stack = STACKS[context];

  const report = [
    `Process:               portfolio-server [4521]`,
    `Path:                  /Users/Jordan/server/index.js`,
    `Identifier:            com.jordan.portfolio`,
    `Version:               1.0.0`,
    `Code Type:             ARM-64 (Native)`,
    `Parent Process:        zsh [892]`,
    `User ID:               501`,
    ``,
    `Date/Time:             ${now()}`,
    `OS Version:            macOS 15.4 (24E5238a)`,
    `Report Version:        12`,
    `Anonymous UUID:        B4D-C0FF-EE00-0000-CAFE`,
    ``,
    `Time Awake Since Boot: 420 seconds`,
    ``,
    `Exception Type:        SIGCOFFEE`,
    `Exception Codes:       0x0000000000000000, caffeine level critical`,
    `Exception Note:        EXC_CORPSE_NOTIFY`,
    `Termination Reason:    The server needed a break`,
    `Triggering Thread:     0`,
    ``,
    `Thread 0 Crashed::    Dispatch queue: com.jordan.portfolio.requests`,
    ...stack,
    ``,
    `Thread 0 crashed with ARM Thread State (64-bit):`,
    `    x0: 0x0000000000000000   x1: 0x0000000000000000   x2: 0x0000000000000000`,
    `    x3: 0x00000000cafebabe   x4: 0x0000000000000000   x5: 0x0000000000000000`,
    `   x29: 0x0000000000000000   x30: 0x00000001043f2a10   sp: 0x0000000000000000`,
    `    pc: 0x00000001043f2a10 cpsr: 0x0000000060000000`,
    ``,
    `Binary Images:`,
    `   0x100000000 -  0x100001fff +portfolio-server (1.0.0) <CAFE0000-DEAD-BEEF-0000-000000000000>`,
    `                              /Users/Jordan/server/index.js`,
  ];

  return (
    <div className="rounded-xl overflow-hidden border border-xcode-border-light dark:border-xcode-border shadow-xl">
      {/* Title bar */}
      <div className="bg-xcode-sidebar-light dark:bg-[#2D2D2D] px-4 py-2 flex items-center gap-2 border-b border-xcode-border-light dark:border-xcode-border select-none">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <span className="font-mono text-xs text-xcode-muted mx-auto">
          CrashReporter — portfolio-server-{new Date().toISOString().slice(0, 10)}.crash
        </span>
      </div>

      {/* Crash report body */}
      <div className="bg-[#1c1c1e] px-5 py-4 overflow-x-auto max-h-72 overflow-y-auto">
        <pre className="font-mono text-xs leading-5 whitespace-pre">
          {report.map((line, i) => {
            if (line.startsWith('Exception Type:') || line.startsWith('Exception Codes:') || line.startsWith('Termination Reason:')) {
              return <div key={i} style={{ color: '#FC5FA3' }}>{line}</div>;
            }
            if (line.startsWith('Thread 0 Crashed')) {
              return <div key={i} style={{ color: '#FFB340' }}>{line}</div>;
            }
            if (/^\d+\s+/.test(line)) {
              return (
                <div key={i} style={{ color: '#D4D4D4' }}>
                  {line.replace(/0x[0-9a-f]+/g, m => `<hex:${m}>`).split(/<hex:(0x[0-9a-f]+)>/).map((part, j) =>
                    part.startsWith('0x')
                      ? <span key={j} style={{ color: '#D0BF69' }}>{part}</span>
                      : <span key={j}>{part}</span>
                  )}
                </div>
              );
            }
            if (line === '') {
              return <div key={i}>&nbsp;</div>;
            }
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0 && colonIdx < 32) {
              const label = line.slice(0, colonIdx + 1);
              const value = line.slice(colonIdx + 1);
              return (
                <div key={i}>
                  <span style={{ color: '#8E8E93' }}>{label}</span>
                  <span style={{ color: '#D4D4D4' }}>{value}</span>
                </div>
              );
            }
            return <div key={i} style={{ color: '#8E8E93' }}>{line}</div>;
          })}
        </pre>
      </div>
    </div>
  );
}
