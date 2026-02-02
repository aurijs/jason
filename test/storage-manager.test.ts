import { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { ConfigManager } from "../src/layers/config.js";
import { JsonFile } from "../src/layers/json-file.js";
import { Json } from "../src/layers/json.js";
import { makeStorageManager } from "../src/make/storage-manager.js";

const PersonSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number
});

describe("StorageManager", () => {
  it("should read and write documents", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();

        const config = {
          base_path: tempDir,
          collections: {
            users: PersonSchema
          }
        };

        const TestLayer = Layer.mergeAll(
          JsonFile.Default,
          Json.Default,
          BunContext.layer,
          ConfigManager.Default(config)
        );

        // Ensure collection directory exists
        const collection_path = path.join(tempDir, "users");
        yield* fs.makeDirectory(collection_path, { recursive: true });

        const storage = yield* makeStorageManager<any>("users").pipe(
            Effect.provide(TestLayer)
        );
        const doc = { id: "1", name: "Jason", age: 42 };

        yield* storage.write("1", doc);
        const readDoc = yield* storage.read("1");

        expect(readDoc).toEqual(doc);
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });

  it("should return undefined if document does not exist", async () => {
     const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();

        const config = {
          base_path: tempDir,
          collections: {
            users: PersonSchema
          }
        };

        const TestLayer = Layer.mergeAll(
          JsonFile.Default,
          Json.Default,
          BunContext.layer,
          ConfigManager.Default(config)
        );

        const storage = yield* makeStorageManager<any>("users").pipe(
            Effect.provide(TestLayer)
        );
        const readDoc = yield* storage.read("non-existent");

        expect(readDoc).toBeUndefined();
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });

  it("should read all documents", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();

        const config = {
          base_path: tempDir,
          collections: {
            users: PersonSchema
          }
        };

        const TestLayer = Layer.mergeAll(
          JsonFile.Default,
          Json.Default,
          BunContext.layer,
          ConfigManager.Default(config)
        );

        const collection_path = path.join(tempDir, "users");
        yield* fs.makeDirectory(collection_path, { recursive: true });

        const storage = yield* makeStorageManager<any>("users").pipe(
            Effect.provide(TestLayer)
        );
        
        const docs = [
            { id: "1", name: "Jason", age: 42 },
            { id: "2", name: "Auri", age: 30 }
        ];

        for (const doc of docs) {
            yield* storage.write(doc.id, doc);
        }

        const readDocs = yield* Stream.runCollect(storage.readAll);

        expect(Array.from(readDocs)).toEqual(expect.arrayContaining(docs));
        expect(readDocs.length).toBe(2);
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });
});
