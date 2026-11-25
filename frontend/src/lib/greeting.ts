/** A hello for the developers who open the browser's console. Nothing is sent anywhere. */
export function logDevtoolsGreeting(log: (...args: unknown[]) => void = console.info): void {
  log('%cHello, fellow developer.', 'font-weight: bold; font-size: 14px');
  log('Poking around? Try the >_ button at the bottom right of the page, and type `help`.');
}
