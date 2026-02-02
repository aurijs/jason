import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ConfigManager } from "../src/layers/config.js";
import { JsonFile } from "../src/layers/json-file.js";
import { Json } from "../src/layers/json.js";
import { makeStorageManager } from "../src/make/storage-manager.js";

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String
});

describe("StorageManager Caching", () => {
  it("should cache read results", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        
        const config = {
          base_path: tempDir,
          collections: {
            users: UserSchema
          }
        };

        const TestLayer = Layer.mergeAll(
            Json.Default,
            ConfigManager.Default(config),
            JsonFile.Default,
            BunContext.layer
        );

        yield* Effect.gen(function* () {
            const storage = yield* makeStorageManager<Schema.Schema.Type<typeof UserSchema>>("users", {
                cacheCapacity: 10
            });
            const jsonFile = yield* JsonFile;
            const collection_path = yield* (yield* ConfigManager).getCollectionPath("users");
            yield* fs.makeDirectory(collection_path, { recursive: true });

            // Spy on readJsonFile
            const readSpy = vi.spyOn(jsonFile, 'readJsonFile');

            yield* storage.write("1", { id: "1", name: "Alice" });
            
            // First read - should access file system
            const res1 = yield* storage.read("1");
            expect(res1?.name).toBe("Alice");
            expect(readSpy).toHaveBeenCalledTimes(1);

            // Second read - should NOT access file system (if caching is working)
            const res2 = yield* storage.read("1");
            expect(res2?.name).toBe("Alice");
            expect(readSpy).toHaveBeenCalledTimes(1); 

            readSpy.mockRestore();
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(
        Effect.provide(BunContext.layer)
    );

    await Effect.runPromise(program);
  });

  it("should invalidate cache on remove", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const config = { base_path: tempDir, collections: { users: UserSchema } };
        const TestLayer = Layer.mergeAll(Json.Default, ConfigManager.Default(config), JsonFile.Default, BunContext.layer);

        yield* Effect.gen(function* () {
            const storage = yield* makeStorageManager<Schema.Schema.Type<typeof UserSchema>>("users", { cacheCapacity: 10 });
            const collection_path = yield* (yield* ConfigManager).getCollectionPath("users");
            yield* fs.makeDirectory(collection_path, { recursive: true });
            const jsonFile = yield* JsonFile;
            const readSpy = vi.spyOn(jsonFile, 'readJsonFile');

            yield* storage.write("1", { id: "1", name: "Alice" });
            yield* storage.read("1"); // Cache it
            expect(readSpy).toHaveBeenCalledTimes(1);

            yield* storage.remove("1");
            
            // Should call readJsonFile again and fail/return undefined
            const res = yield* storage.read("1");
            expect(res).toBeUndefined();
            expect(readSpy).toHaveBeenCalledTimes(2);

            readSpy.mockRestore();
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(Effect.provide(BunContext.layer));
    await Effect.runPromise(program);
  });

  it("should respect cache capacity (LRU)", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const config = { base_path: tempDir, collections: { users: UserSchema } };
        const TestLayer = Layer.mergeAll(Json.Default, ConfigManager.Default(config), JsonFile.Default, BunContext.layer);

        yield* Effect.gen(function* () {
            const storage = yield* makeStorageManager<Schema.Schema.Type<typeof UserSchema>>("users", { cacheCapacity: 2 });
            const collection_path = yield* (yield* ConfigManager).getCollectionPath("users");
            yield* fs.makeDirectory(collection_path, { recursive: true });
            const jsonFile = yield* JsonFile;
            const readSpy = vi.spyOn(jsonFile, 'readJsonFile');

            yield* storage.write("1", { id: "1", name: "Alice" });
            yield* storage.write("2", { id: "2", name: "Bob" });
            yield* storage.write("3", { id: "3", name: "Charlie" });

            yield* storage.read("1"); // 1 is in cache
            yield* storage.read("2"); // 2 is in cache
            expect(readSpy).toHaveBeenCalledTimes(2);

            yield* storage.read("3"); // 3 should evict 1 (LRU)
            expect(readSpy).toHaveBeenCalledTimes(3);

            yield* storage.read("2"); // 2 is still in cache
            expect(readSpy).toHaveBeenCalledTimes(3);

            yield* storage.read("1"); // 1 was evicted, should be read from FS again
            expect(readSpy).toHaveBeenCalledTimes(4);

            readSpy.mockRestore();
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(Effect.provide(BunContext.layer));
    await Effect.runPromise(program);
  });
});
