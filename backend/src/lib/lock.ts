const tails = new Map<string, Promise<void>>();

/**
 * Runs `fn` after every earlier call with the same key has finished, so read-modify-write sequences
 * (read a record, merge, write it, regenerate the indexes) can't interleave.
 *
 * This only serializes work inside one Node process. If Passenger ever runs several processes for the
 * site, writes in different processes can still race (atomic renames keep files whole, but the last
 * writer wins). See "Concurrency" in DEVDOC.md.
 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(fn);
  const tail = run.then(() => {}, () => {});
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
