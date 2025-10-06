import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { JsonFile } from "../layers/json-file.js";
import { ConfigManager } from "../layers/config.js";

export const makeStorageManager = <Doc extends Record<string, any>>(
  collection_name: string
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonFile = yield* JsonFile;
    const config = yield* ConfigManager;

    const schema = yield* config.getCollectionSchema(collection_name);
    const collection_path = yield* config.getCollectionPath(collection_name);

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

      readAll: Effect.gen(function* () {
        const files = yield* fs.readDirectory(collection_path);
        const docs = yield* Effect.all(
          files
            .filter((file) => !file.startsWith("_"))
            .map((file) => read(file.replace(".json", "")))
        );
        return docs.filter((doc): doc is Doc => doc !== undefined);
      })
    };
  });
