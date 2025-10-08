import { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Schedule } from "effect";

export class AtomicWriter extends Effect.Service<AtomicWriter>()(
  "AtomicWriter",
  {
    dependencies: [BunContext.layer],
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const semaphore = yield* Effect.makeSemaphore(1);

      return {
        write: (file_path: string, content: string) => {
          const temp_path = path.join(
            path.dirname(file_path),
            `.${path.basename(file_path)}.tmp`
          );
          const atomic_write_effect = Effect.gen(function* () {
            yield* fs.writeFileString(temp_path, content);

            const rename_with_retry = fs
              .rename(temp_path, file_path)
              .pipe(
                Effect.retry(
                  Schedule.recurs(10).pipe(
                    Schedule.addDelay(() => "100 millis")
                  )
                )
              );

            yield* rename_with_retry.pipe(
              Effect.ensuring(
                fs.remove(temp_path, { recursive: true }).pipe(Effect.ignore)
              )
            );
          });

          return semaphore.withPermits(1)(atomic_write_effect);
        }
      };
    })
  }
) {}
