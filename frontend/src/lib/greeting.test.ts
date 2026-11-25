import { describe, expect, it, vi } from 'vitest';
import { logDevtoolsGreeting } from './greeting';

describe('logDevtoolsGreeting', () => {
  it('logs a friendly pointer to the console, once per line, through the logger it is given', () => {
    const log = vi.fn();
    logDevtoolsGreeting(log);
    expect(log).toHaveBeenCalledTimes(2);
    expect(String(log.mock.calls[1][0])).toContain('help');
  });

  it('defaults to console.info and does not throw', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logDevtoolsGreeting();
    expect(info).toHaveBeenCalled();
  });
});
