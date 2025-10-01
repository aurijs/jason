import { FileSystem, Path } from "@effect/platform";
import {
  Effect,
  Exit,
  Fiber,
  Option,
  Ref,
  Schema,
  Scope,
  Stream
} from "effect";
import { JsonService } from "../services/json.js";
import { WALOperationSchema, type WALOperation } from "../types/wal.js";
import type { PlatformError } from "@effect/platform/Error";

export const makeWal = (wal_path: string, max_segment_size: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const json = yield* JsonService;

    yield* fs.makeDirectory(wal_path, { recursive: true });

    const write_semaphore = yield* Effect.makeSemaphore(1);

    // effect to get and order log segments
    const get_log_segments = fs.readDirectory(wal_path).pipe(
      Effect.map((files) =>
        files
          .filter((f) => f.startsWith("segment-") && f.endsWith(".log"))
          .map((f) => parseInt(f.split("-")[1], 10))
          .sort((a, b) => a - b)
      )
    );

    const file_state_ref = yield* Ref.make<{
      segment: number;
      handle: FileSystem.File;
      fiber: Fiber.RuntimeFiber<FileSystem.File, PlatformError>;
    } | null>(null);

    // the last fiber is interrupted when the service is finilized
    yield* Effect.addFinalizer(() =>
      Ref.get(file_state_ref).pipe(
        Effect.flatMap((state) =>
          state ? Fiber.interrupt(state.fiber) : Effect.void
        )
      )
    );

    const openFileInScopedFiber = (segment: number) =>
      Effect.gen(function* () {
        const open_effect = fs.open(
          path.join(wal_path, `segment-${segment}.log`),
          {
            flag: "a"
          }
        );

        const fiber = yield* Effect.fork(Effect.scoped(open_effect));
        const handle = yield* Fiber.join(fiber);

        return {
          segment,
          handle,
          fiber
        };
      });

    const ensure_file_open = Effect.gen(function* () {
      let state = yield* Ref.get(file_state_ref);

      if (state) {
        const stats = yield* state.handle.stat;
        if (stats.size > max_segment_size) {
          yield* Fiber.interrupt(state.fiber);

          const new_segment = state.segment + 1;
          const new_state = yield* openFileInScopedFiber(new_segment);
          yield* Ref.set(file_state_ref, new_state);

          return new_state;
        }

        return state;
      } else {
        const segments = yield* get_log_segments;
        const initial_segment =
          segments.length > 0 ? segments[segments.length - 1] : 1;
        const initial_state = yield* openFileInScopedFiber(initial_segment);

        yield* Ref.set(file_state_ref, initial_state);
        return initial_state;
      }
    });

    const log = (op: WALOperation) => {
      const write_effect = Effect.gen(function* () {
        const { segment, handle } = yield* ensure_file_open;

        const line = yield* Schema.encode(WALOperationSchema)(op).pipe(
          Effect.flatMap(json.stringify),
          Effect.map((l) => l + "\n")
        );

        yield* handle.write(Buffer.from(line));
        yield* handle.sync; // durability ganrantee

        const final_stats = yield* handle.stat;
        return { segment, position: final_stats.size };
      });

      return write_semaphore
        .withPermits(1)(write_effect)
        .pipe(
          Effect.mapError(
            (e) => new Error("Fail while writing to WAL", { cause: e })
          )
        );
    };

    const replay = Stream.fromEffect(get_log_segments).pipe(
      Stream.flatMap((segments) => Stream.fromIterable(segments)),
      Stream.flatMap((segment) =>
        fs.stream(path.join(wal_path, `segment-${segment}.log`)).pipe(
          Stream.decodeText("utf-8"),
          Stream.splitLines,
          Stream.mapEffect((line) =>
            json.parse(line).pipe(
              Effect.flatMap((p) => Schema.decode(WALOperationSchema)(p)),
              Effect.map((op) => ({ op, segment, position: 0n })) // Cast para o tipo explícito
            )
          )
        )
      ),
      Stream.mapError(
        (e) => new Error("Fail while replaying WAL", { cause: e })
      )
    );

    const checkpoint = (up_to_segment: number) =>
      Effect.gen(function* () {
        const segments = yield* get_log_segments;
        const current_state = yield* Ref.get(file_state_ref);
        const current_segment =
          current_state?.segment ??
          (segments.length > 0 ? segments[segments.length - 1] : 1);
        const segments_to_delete = segments.filter(
          (s) => s <= up_to_segment && s < current_segment // Nunca deleta o segmento ativo!
        );

        yield* Effect.all(
          segments_to_delete.map((s) =>
            fs.remove(path.join(wal_path, `segment-${s}.log`))
          ),
          { discard: true }
        );
      }).pipe(
        Effect.mapError(
          (e) => new Error("Fail while checkpointing WAL", { cause: e })
        )
      );

    return {
      log,
      replay,
      checkpoint
    };
  });
