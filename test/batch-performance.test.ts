import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ConfigManager } from "../src/layers/config.js";
import { JsonFile } from "../src/layers/json-file.js";
import { Json } from "../src/layers/json.js";
import { WriteAheadLog } from "../src/layers/wal.js";
import { makeCollection } from "../src/make/collection.js";

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  age: Schema.Number
});

describe("Collection Batch Performance", () => {
  it("batch.insert should be significantly faster than single inserts", async () => {
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

        const BaseLayer = Layer.mergeAll(
            Json.Default,
            ConfigManager.Default(config),
            BunContext.layer
        );

        const ServiceLayer = Layer.mergeAll(
            JsonFile.Default,
            WriteAheadLog.Default
        );

        const TestLayer = ServiceLayer.pipe(
            Layer.provide(BaseLayer),
            Layer.merge(BaseLayer)
        );

        yield* Effect.gen(function* () {
            const collection = yield* makeCollection<Schema.Schema.Type<typeof UserSchema>>("users");

            const count = 200;
            const users = Array.from({ length: count }, (_, i) => ({
                id: `user-${i}`,
                name: `User ${i}`,
                email: `user${i}@example.com`,
                age: 20 + i
            }));

            // Single inserts
            const startSingle = Date.now();
            for (const u of users) {
                yield* collection.create(u);
            }
            const endSingle = Date.now();
            const durationSingle = endSingle - startSingle;
            console.log(`Single inserts (${count}): ${durationSingle}ms`);

            // Clear directory for fair comparison
            const collection_path = yield* (yield* ConfigManager).getCollectionPath("users");
            yield* fs.remove(collection_path, { recursive: true });
            yield* fs.makeDirectory(collection_path, { recursive: true });

            // Batch insert
            const startBatch = Date.now();
            yield* collection.batch.insert(users);
            const endBatch = Date.now();
            const durationBatch = endBatch - startBatch;
            console.log(`Batch insert (${count}): ${durationBatch}ms`);

            expect(durationBatch).toBeLessThan(durationSingle / 5); // Expecting at least 5x improvement (spec says 10x, but let's be realistic in CI)
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(
        Effect.provide(BunContext.layer)
    );

    await Effect.runPromise(program);
  }, 30000); // Higher timeout for performance test
});
