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
});

describe("Batch Operations", () => {
  it("batch.insert with 10 documents returns success summary", async () => {
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

        return yield* Effect.gen(function* () {
          const collection = yield* makeCollection<Schema.Schema.Type<typeof UserSchema>>("users");
          
          const docs = Array.from({ length: 10 }, (_, i) => ({
            id: `user-${i}`,
            name: `User ${i}`,
            email: `user${i}@example.com`
          }));

          const result = yield* collection.batch.insert(docs);

          expect(result.success).toBe(10);
          expect(result.failures).toHaveLength(0);

          // Verify they actually exist
          const count = yield* collection.count;
          expect(count).toBe(10);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });

  it("batch.insert with some invalid documents returns partial failure summary", async () => {
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

        return yield* Effect.gen(function* () {
          const collection = yield* makeCollection<Schema.Schema.Type<typeof UserSchema>>("users");
          
          const docs: any[] = [
            { id: "user-1", name: "User 1", email: "user1@example.com" },
            { id: "user-2", name: 123, email: "user2@example.com" }, // Invalid name
            { id: "user-3", name: "User 3", email: "user3@example.com" }
          ];

          const result = yield* collection.batch.insert(docs);

          expect(result.success).toBe(2);
          expect(result.failures).toHaveLength(1);
          expect(result.failures[0].index).toBe(1);

          // Verify only 2 exist
          const count = yield* collection.count;
          expect(count).toBe(2);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });

  it("batch.delete with a filter removes multiple documents", async () => {
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

        return yield* Effect.gen(function* () {
          const collection = yield* makeCollection<Schema.Schema.Type<typeof UserSchema>>("users");
          
          // Seed data
          yield* collection.batch.insert([
            { id: "user-1", name: "Alice", email: "alice@example.com" },
            { id: "user-2", name: "Bob", email: "bob@example.com" },
            { id: "user-3", name: "Charlie", email: "charlie@example.com" },
            { id: "user-4", name: "Alice", email: "alice2@example.com" }
          ]);

          // Delete all Alice
          const result = yield* collection.batch.delete({ name: "Alice" });

          expect(result.success).toBe(2);
          expect(result.failures).toHaveLength(0);

          const count = yield* collection.count;
          expect(count).toBe(2);

          const remaining = yield* collection.find({ where: { name: "Alice" } });
          expect(remaining).toHaveLength(0);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });

  it("batch.update with a filter modifies multiple documents", async () => {
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

        return yield* Effect.gen(function* () {
          const collection = yield* makeCollection<Schema.Schema.Type<typeof UserSchema>>("users");
          
          // Seed data
          yield* collection.batch.insert([
            { id: "user-1", name: "Alice", email: "alice@example.com" },
            { id: "user-2", name: "Bob", email: "bob@example.com" },
            { id: "user-3", name: "Charlie", email: "charlie@example.com" }
          ]);

          // Update all
          const result = yield* collection.batch.update({}, { name: "Updated Name" });

          expect(result.success).toBe(3);
          expect(result.failures).toHaveLength(0);

          const updated = yield* collection.find({ where: { name: "Updated Name" } });
          expect(updated).toHaveLength(3);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });
});