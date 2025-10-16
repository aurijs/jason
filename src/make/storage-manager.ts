import { FileSystem } from "@effect/platform";
import { Effect, Stream } from "effect";
import { JsonFile } from "../layers/json-file.js";
import { ConfigManager } from "../layers/config.js";

interface StorageManagerOptions {
  readonly file_filter?: (filename: string) => boolean;
}

interface StorageManager<Doc> {
  readonly read: (id: string) => Effect.Effect<Doc | undefined, Error>;
  readonly write: (id: string, doc: any) => Effect.Effect<void, Error>;
  readonly remove: (id: string) => Effect.Effect<void, Error>;
  readonly exists: (id: string) => Effect.Effect<boolean, Error>;
  readonly readAll: Stream.Stream<Doc, Error>;
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
      options?.file_filter ?? ((file) => !file.startsWith("-"));

    const read = (id: string) =>
      jsonFile
        .readJsonFile(`${collection_path}/${id}.json`, schema)
        .pipe(
          Effect.catchTag("SystemError", (e) =>
            e.reason === "NotFound" ? Effect.succeed(undefined) : Effect.fail(e)
          )
        );

    return {
      read,
      write: (id: string, doc: any) =>
        jsonFile.writeJsonFile(`${collection_path}/${id}.json`, schema, doc),

      remove: (id: string) => fs.remove(`${collection_path}/${id}.json`),
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
