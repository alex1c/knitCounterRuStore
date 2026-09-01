/**
 * Per-counter mutation queue — serializes rapid taps without global locks.
 */

type Task<T> = () => T | Promise<T>;

const queues = new Map<string, Promise<unknown>>();

/**
 * Enqueues a mutation for the given counter id.
 * Tasks for the same counter run sequentially; different counters run in parallel.
 */
export function enqueueCounterMutation<T>(
  counterId: string,
  task: Task<T>
): Promise<T> {
  const previous = queues.get(counterId) ?? Promise.resolve();
  const next = previous
    .catch(() => {
      // Keep the queue alive after a failed mutation.
    })
    .then(() => task());

  queues.set(counterId, next);
  return next.finally(() => {
    if (queues.get(counterId) === next) {
      queues.delete(counterId);
    }
  });
}

/** Clears queued state — useful in tests. */
export function clearCounterQueues(): void {
  queues.clear();
}
