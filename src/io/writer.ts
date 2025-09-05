import { Deferred, Effect, Layer, Queue, Ref } from "effect";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { WriterConfig, WriterService } from "./writer.service.js";

const random_string = Effect.sync(
  () => Math.random().toString(36).slice(2) + Date.now().toString(36)
);

const get_temp_path = (path: string) =>
  Effect.gen(function* () {
    return join(path, `$.tmp_${yield* random_string}`);
  });

const get_file_path = (basePath: string, fileName: string) =>
  Effect.sync(() => join(basePath, `${fileName}.json`));

type WriteRequest = [string, Deferred.Deferred<void, Error>];

export const WriterLive = Layer.effect(
  WriterService,
  Effect.gen(function* () {
    const { basePath } = yield* WriterConfig;
    const fileQueues = yield* Ref.make(new Map<string, Queue<WriteRequest>>());

    const atomicWrite = (tempPath: string, filePath: string, data: string) =>
      Effect.tryPromise({
        try: async () => {
          await writeFile(tempPath, data, "utf-8");
          await rename(tempPath, filePath);
        },
        catch: (error) => new Error(String(error)),
      });

    const processFileQueue = (
      queue: Queue<WriteRequest>,
      fileName: string
    ) =>
      Effect.gen(function* () {
        const [data, deferred] = yield* Queue.take(queue);
        const filePath = yield* get_file_path(basePath, fileName);
        const tempPath = yield* get_temp_path(basePath);
        const result = yield* Effect.exit(atomicWrite(tempPath, filePath, data));
        yield* Effect.match(result, {
          onFailure: (cause) => Deferred.fail(deferred, cause.squash),
          onSuccess: () => Deferred.succeed(deferred, undefined),
        });
      }).pipe(Effect.forever);

    const getOrCreateQueue = (fileName: string) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(fileQueues);
        let queue = map.get(fileName);
        if (!queue) {
          queue = yield* Queue.unbounded<WriteRequest>();
          yield* Ref.update(fileQueues, (map) => map.set(fileName, queue!));
          yield* processFileQueue(queue, fileName).pipe(Effect.forkDaemon);
        }
        return queue;
      });

    return {
      write: (fileName: string, data: string) =>
        Effect.gen(function* () {
          const deferred = yield* Deferred.make<void, Error>();
          const queue = yield* getOrCreateQueue(fileName);
          yield* Queue.offer(queue, [data, deferred]);
          return yield* Deferred.await(deferred);
        }),
    };
  })
);