import { FileSystem, Path } from "@effect/platform";
import {
  Chunk,
  Deferred,
  Effect,
  Exit,
  Option,
  Queue,
  Ref,
  Schema,
  Scope,
  Stream
} from "effect";
import {
  WalCheckpointError,
  WalInitializationError,
  WalReplayError,
  WalWriteError
} from "../core/errors.js";
import { Json } from "../layers/json.js";
import { WALOperationSchema, type WALOperation } from "../types/wal.js";

type WriteRequest = readonly [
  WALOperation,
  Deferred.Deferred<{ segment: number; position: bigint }, WalWriteError>
];

export const makeWal = (wal_path: string, max_segment_size: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const json = yield* Json;

    yield* fs.makeDirectory(wal_path, { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new WalInitializationError({
            reason: "DirectoryCreationError",
            cause
          })
      )
    );

    // effect to get and order log segments
    const get_log_segments = fs.readDirectory(wal_path).pipe(
      Effect.map((files) =>
        files
          .filter((f) => f.startsWith("segment-") && f.endsWith(".log"))
          .map((f) => parseInt(f.split("-")[1], 10))
          .sort((a, b) => a - b)
      ),
      Effect.mapError(
        (cause) =>
          new WalInitializationError({ cause, reason: "DirectoryReadError" })
      )
    );

    const queue = yield* Queue.unbounded<WriteRequest>();

    // const write_semaphore = yield* Effect.makeSemaphore(1);

    const file_state_ref = yield* Ref.make<{
      segment: number;
      handle: FileSystem.File;
      scope: Scope.CloseableScope;
      size_ref: Ref.Ref<FileSystem.Size>;
    } | null>(null);

    yield* Effect.addFinalizer(() => Queue.shutdown(queue).pipe(Effect.asVoid));

    yield* Effect.addFinalizer(() =>
      Ref.get(file_state_ref).pipe(
        Effect.flatMap((state) =>
          state ? Scope.close(state.scope, Exit.void) : Effect.void
        )
      )
    );

    const openFileInScope = (segment: number) =>
      Effect.gen(function* () {
        const scope = yield* Scope.make();

        const handle = yield* fs
          .open(path.join(wal_path, `segment-${segment}.log`), {
            flag: "a"
          })
          .pipe(Scope.extend(scope));

        const stats = yield* handle.stat;

        const size_ref = yield* Ref.make(stats.size);

        return {
          segment,
          handle,
          scope,
          size_ref
        };
      });

    const ensure_file_open = Effect.gen(function* () {
      let state = yield* Ref.get(file_state_ref);

      if (state) {
        const current_size = yield* Ref.get(state.size_ref);
        if (current_size > max_segment_size) {
          yield* Scope.close(state.scope, Exit.void);

          const new_segment = state.segment + 1;
          const new_state = yield* openFileInScope(new_segment);
          yield* Ref.set(file_state_ref, new_state);

          return new_state;
        }

        return state;
      } else {
        const segments = yield* get_log_segments;
        const initial_segment =
          segments.length > 0 ? segments[segments.length - 1] : 1;
        const initial_state = yield* openFileInScope(initial_segment);

        yield* Ref.set(file_state_ref, initial_state);
        return initial_state;
      }
    });

    const processor = Stream.fromQueue(queue).pipe(
      Stream.groupedWithin(1024, "50 millis"),
      Stream.runForEach((request) =>
        Effect.gen(function* () {
          const { segment, handle, size_ref } = yield* ensure_file_open;
          const lines = yield* Effect.all(
            Chunk.map(request, ([op]) =>
              Schema.encode(WALOperationSchema)(op).pipe(
                Effect.flatMap(json.stringify),
                Effect.map((l) => l + "\n")
              )
            ),
            { concurrency: "unbounded" }
          );

          const content = Buffer.from(lines.join(""));
          yield* handle.write(content);
          yield* handle.sync;

          const final_stats = yield* handle.stat;
          yield* Ref.set(size_ref, final_stats.size);

          yield* Effect.all(
            Chunk.map(request, ([, deferred]) =>
              Deferred.succeed(deferred, {
                segment,
                position: final_stats.size
              })
            ),
            { discard: true, concurrency: "unbounded" }
          );
        }).pipe(
          Effect.catchAll((cause) =>
            Effect.all(
              Chunk.map(request, ([_, deferred]) =>
                Deferred.fail(
                  deferred,
                  new WalWriteError({ cause, reason: "FileSystemError" })
                )
              ),
              { discard: true }
            )
          )
        )
      )
    );

    yield* Effect.forkDaemon(processor);

    return {
      /**
       * Durably logs a database operation by appending it to the write-ahead log.
       *
       * @param op The operation to be logged.
       * @returns An Effect that resolves with the segment number and the final write position,
       * which are crucial for checkpointing.
       */
      log: (op: WALOperation) =>
        Effect.gen(function* () {
          const deferred = yield* Deferred.make<
            {
              segment: number;
              position: bigint;
            },
            WalWriteError
          >();

          yield* Queue.offer(queue, [op, deferred] as const);
          return yield* Deferred.await(deferred);
        }),

      /**
       * Reads the entire WAL history, replaying operations segment by segment in order.
       *
       * @returns A Stream of operations that the Applier can process during initialization
       * to restore the database state.
       */
      replay: Stream.fromEffect(get_log_segments).pipe(
        Stream.mapError(
          (cause) => new WalReplayError({ cause, reason: "DirectoryReadError" })
        ),
        Stream.flatMap((segments) => Stream.fromIterable(segments)),
        Stream.flatMap((segment) =>
          fs.stream(path.join(wal_path, `segment-${segment}.log`)).pipe(
            Stream.mapError(
              (cause) => new WalReplayError({ cause, reason: "FileReadError" })
            ),
            Stream.decodeText("utf-8"),
            Stream.splitLines,
            Stream.mapEffect(
              (line) =>
                json.parse(line).pipe(
                  Effect.flatMap((p) => Schema.decode(WALOperationSchema)(p)),
                  Effect.map((op) => ({ op, segment, position: 0n })),
                  Effect.catchAll((cause) =>
                    Effect.logWarning("Skipping corrupted WAL line").pipe(
                      Effect.annotateLogs("line", line),
                      Effect.annotateLogs("cause", cause),
                      Effect.andThen(Effect.fail(Option.none()))
                    )
                  )
                ),
              { concurrency: "unbounded" }
            ),
            Stream.catchAll(() => Stream.empty)
          )
        ),
        Stream.mapError(
          (cause) => new WalReplayError({ cause, reason: "FileReadError" })
        )
      ),

      /**
       * Performs a checkpoint by removing all log segments up to and
       * including the specified segment number.
       *
       * This consolidates the database state and frees up space.
       */
      checkpoint: (up_to_segment: number) =>
        Effect.gen(function* () {
          const segments = yield* get_log_segments.pipe(
            Effect.mapError(
              (cause) =>
                new WalCheckpointError({ cause, reason: "DirectoryReadError" })
            )
          );
          const current_state = yield* Ref.get(file_state_ref);
          const current_segment =
            current_state?.segment ??
            (segments.length > 0 ? segments[segments.length - 1] : 1);
          const segments_to_delete = segments.filter(
            (s) => s <= up_to_segment && s < current_segment
          );

          yield* Effect.all(
            segments_to_delete.map((s) =>
              fs.remove(path.join(wal_path, `segment-${s}.log`))
            ),
            { discard: true, concurrency: "unbounded" }
          ).pipe(
            Effect.mapError(
              (cause) =>
                new WalCheckpointError({ cause, reason: "FileRemoveError" })
            )
          );
        })
    };
  }).pipe(
    Effect.mapError((cause) => {
      if (cause instanceof WalInitializationError) return cause;
      return new WalInitializationError({
        reason: "DirectoryCreationError",
        cause
      });
    })
  );
