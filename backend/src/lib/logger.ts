import { appendFileSync, mkdirSync } from 'fs';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logDir = join(process.cwd(), 'logs');
const logPath = join(logDir, 'app.log');
const buffer: string[] = [];

function entry(level: string, msg: string): string {
  return `[${new Date().toISOString()}] [${level.padEnd(5)}] ${msg}`;
}

function log(level: string, consoleFn: (...args: unknown[]) => void, msg: string) {
  const line = entry(level, msg);
  consoleFn(line);
  buffer.push(line);
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const lines = buffer.splice(0);
  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(logPath, lines.join('\n') + '\n');
  } catch {
    buffer.unshift(...lines);
  }
}

function flushSync(): void {
  if (buffer.length === 0) return;
  const lines = buffer.splice(0);
  try {
    mkdirSync(logDir, { recursive: true });
    appendFileSync(logPath, lines.join('\n') + '\n');
  } catch {}
}

// Flush to disk every 5 seconds. .unref() so this timer doesn't prevent the
// process from exiting naturally if everything else is done.
setInterval(flush, 5_000).unref();

// Flush before Passenger/OS kills the process
process.on('SIGTERM', async () => { await flush(); process.exit(0); });
process.on('SIGINT',  async () => { await flush(); process.exit(0); });

// Last-resort synchronous flush in case exit happens without a signal
process.on('exit', flushSync);

export const logger = {
  info:  (msg: string) => log('INFO',  console.log,   msg),
  warn:  (msg: string) => log('WARN',  console.warn,  msg),
  error: (msg: string) => log('ERROR', console.error, msg),
};
