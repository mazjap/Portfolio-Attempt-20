import { appendFileSync, mkdirSync } from 'fs';
import { appendFile, mkdir, rename, stat } from 'fs/promises';
import { join } from 'path';

const logDir = join(process.cwd(), 'logs');
const logPath = join(logDir, 'app.log');
const buffer: string[] = [];

// app.log is rotated to app.log.1 (replacing the previous one) when it passes this size, so the logs
// use at most about twice this much disk.
const MAX_LOG_BYTES = 5 * 1024 * 1024;
// If the disk keeps refusing writes, keep only this many lines in memory.
const MAX_BUFFERED_LINES = 5_000;
let droppedLines = 0;

function entry(level: string, msg: string): string {
  return `[${new Date().toISOString()}] [${level.padEnd(5)}] ${msg}`;
}

function trimBuffer(): void {
  const excess = buffer.length - MAX_BUFFERED_LINES;
  if (excess > 0) {
    buffer.splice(0, excess);
    droppedLines += excess;
  }
}

function log(level: string, consoleFn: (...args: unknown[]) => void, msg: string) {
  const line = entry(level, msg);
  consoleFn(line);
  buffer.push(line);
  trimBuffer();
}

async function rotateIfNeeded(): Promise<void> {
  try {
    if ((await stat(logPath)).size >= MAX_LOG_BYTES) await rename(logPath, `${logPath}.1`);
  } catch {
    // No log file yet.
  }
}

export async function flushLogs(): Promise<void> {
  if (buffer.length === 0) return;
  const lines = buffer.splice(0);
  if (droppedLines > 0) {
    lines.unshift(entry('WARN', `${droppedLines} log lines were dropped while the log file couldn't be written`));
    droppedLines = 0;
  }
  try {
    await mkdir(logDir, { recursive: true });
    await rotateIfNeeded();
    await appendFile(logPath, lines.join('\n') + '\n');
  } catch {
    buffer.unshift(...lines);
    trimBuffer();
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
setInterval(flushLogs, 5_000).unref();

// Last-resort synchronous flush. Signals are handled by the server (index.ts), which closes
// connections and then calls flushLogs().
process.on('exit', flushSync);

export const logger = {
  info:  (msg: string) => log('INFO',  console.log,   msg),
  warn:  (msg: string) => log('WARN',  console.warn,  msg),
  error: (msg: string) => log('ERROR', console.error, msg),
};
