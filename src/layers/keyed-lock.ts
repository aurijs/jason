import { Cache, Context, Effect, Layer } from "effect";

/**
 * KeyedLock provides a way to acquire a lock based on a string key.
 * This is useful for ensuring atomicity for operations on the same document.
 */
export class KeyedLock extends Context.Tag("KeyedLock")<
  KeyedLock,
  {
    readonly withLock: <A, E, R>(
      key: string,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>;
  }
>() {}

export const KeyedLockLive = Layer.effect(
  KeyedLock,
  Effect.gen(function* () {
    // We use a Cache to manage semaphores. This provides automatic cleanup
    // of unused semaphores and is more idiomatic than manual Ref management.
    const cache = yield* Cache.make({
      capacity: 10000, // Reasonable limit for concurrent document locks
      timeToLive: "5 minutes", // Cleanup semaphores not used for 5 minutes
      lookup: () => Effect.makeSemaphore(1)
    });

    return {
      withLock: (key, effect) =>
        Effect.gen(function* () {
          const semaphore = yield* cache.get(key);
          return yield* semaphore.withPermits(1)(effect);
        })
    };
  })
);
