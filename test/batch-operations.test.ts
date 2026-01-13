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

describe("Collection Batch Operations", () => {
  it("batch.insert should insert multiple documents", async () => {
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

            const users = Array.from({ length: 10 }, (_, i) => ({
                id: `user-${i}`,
                name: `User ${i}`,
                email: `user${i}@example.com`,
                age: 20 + i
            }));

            const result = yield* collection.batch.insert(users);
            
            expect(result.success).toBe(10);
            expect(result.failures.length).toBe(0);
            
            // Wait for background writes
            yield* Effect.sleep("200 millis");

            const all = yield* collection.find({});
            expect(all.length).toBe(10);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(
        Effect.provide(BunContext.layer),
        Effect.catchAllCause(cause => {
            console.error(cause.toString());
            return Effect.fail(cause);
        })
    );

    await Effect.runPromise(program);
  });

  it("batch.insert should handle partial failures (Best-Effort)", async () => {
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

            const users = [
                { id: "user-1", name: "User 1", email: "user1@example.com", age: 20 },
                { id: "user-2", name: "User 2", email: "user2@example.com", age: "invalid" as any }, // Should fail
                { id: "user-3", name: "User 3", email: "user3@example.com", age: 30 }
            ];

            const result = yield* collection.batch.insert(users);
            
            expect(result.success).toBe(2);
            expect(result.failures.length).toBe(1);
            expect(result.failures[0].index).toBe(1);
            
            yield* Effect.sleep("100 millis");

            const all = yield* collection.find({});
            expect(all.length).toBe(2);
            expect(all.map(u => u.id).sort()).toEqual(["user-1", "user-3"]);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(
        Effect.provide(BunContext.layer)
    );

    await Effect.runPromise(program);
  });

  it("batch.delete should delete multiple documents", async () => {
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

            const users = Array.from({ length: 10 }, (_, i) => ({
                id: `user-${i}`,
                name: `User ${i}`,
                email: `user${i}@example.com`,
                age: i < 5 ? 20 : 30
            }));

            yield* collection.batch.insert(users);
            yield* Effect.sleep("100 millis");

            const result = yield* collection.batch.delete({ age: 20 });
            expect(result.success).toBe(5);
            
            yield* Effect.sleep("100 millis");

            const remaining = yield* collection.find({});
            expect(remaining.length).toBe(5);
            expect(remaining.every(u => u.age === 30)).toBe(true);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(
        Effect.provide(BunContext.layer)
    );

    await Effect.runPromise(program);
  });

  it("batch.update should update multiple documents", async () => {
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

            const users = Array.from({ length: 10 }, (_, i) => ({
                id: `user-${i}`,
                name: `User ${i}`,
                email: `user${i}@example.com`,
                age: i < 5 ? 20 : 30
            }));

            yield* collection.batch.insert(users);
            yield* Effect.sleep("100 millis");

            const result = yield* collection.batch.update({ age: 20 }, { age: 21 });
            expect(result.success).toBe(5);
            
            yield* Effect.sleep("100 millis");

            const updated = yield* collection.find({ where: { age: 21 } });
            expect(updated.length).toBe(5);
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(
        Effect.provide(BunContext.layer)
    );

    await Effect.runPromise(program);
  });
});
