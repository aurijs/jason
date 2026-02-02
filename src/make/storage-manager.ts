import { FileSystem } from "@effect/platform";
import type { SystemError } from "@effect/platform/Error";
import { Cache, Effect, Stream } from "effect";
import { ConfigManager } from "../layers/config.js";
import { JsonFile } from "../layers/json-file.js";

interface StorageManagerOptions {
  readonly file_filter?: (filename: string) => boolean;
  readonly cacheCapacity?: number | undefined;
}

interface StorageManager<Doc> {
  readonly read: (
    id: string
  ) => Effect.Effect<Doc | undefined, Error | SystemError>;
  readonly write: (
    id: string,
    doc: any
  ) => Effect.Effect<void, Error | SystemError>;
  readonly remove: (id: string) => Effect.Effect<void, Error | SystemError>;
  readonly exists: (id: string) => Effect.Effect<boolean, Error | SystemError>;
  readonly readAll: Stream.Stream<Doc, Error | SystemError>;
}

export const makeStorageManager = <Doc extends Record<string, any>>(
  collection_name: string,
  options?: StorageManagerOptions
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonFile = yield* JsonFile;
    const config = yield* ConfigManager;

    const schema = yield* config.getCollectionSchema(collection_name);
    const collection_path = yield* config.getCollectionPath(collection_name);

    const file_filter =
      options?.file_filter ?? ((file) => !file.startsWith("_"));

    const cache = yield* Cache.make({
      capacity: options?.cacheCapacity ?? 1000,
      timeToLive: "24 hours",
      lookup: (id: string) => {
        // Effect.logDebug(`Cache lookup for ${id}`)
        return jsonFile
          .readJsonFile(`${collection_path}/${id}.json`, schema)
          .pipe(
            Effect.catchTag("SystemError", (e) =>
              e.reason === "NotFound"
                ? Effect.succeed(undefined)
                : Effect.fail(e)
            )
          );
      }
    });

    const read = (id: string) =>
      cache.get(id).pipe(
        // Effect.tap((res) => Effect.logDebug(`Cache get for ${id}: ${JSON.stringify(res)}`)),
        Effect.map((res) => res as Doc | undefined)
      );

    return {
      read,
      write: (id: string, doc: any) =>
        jsonFile
          .writeJsonFile(`${collection_path}/${id}.json`, schema, doc)
          .pipe(Effect.zipLeft(cache.invalidate(id))),

      remove: (id: string) =>
        fs
          .remove(`${collection_path}/${id}.json`)
          .pipe(Effect.zipLeft(cache.invalidate(id))),

      exists: (id: string) => fs.exists(`${collection_path}/${id}.json`),

      readAll: Stream.fromEffect(fs.readDirectory(collection_path)).pipe(
        Stream.flatMap(Stream.fromIterable),
        Stream.filter(file_filter),
        Stream.map((file) => file.replace(".json", "")),
        Stream.mapEffect(read, { concurrency: "unbounded" }),
        Stream.filter((doc): doc is Doc => doc !== undefined)
      )
    } as StorageManager<Doc>;
  });
