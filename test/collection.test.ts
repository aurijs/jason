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

describe("Collection Service", () => {
  it("should create and retrieve a document", async () => {
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

            const user = {
                id: "1",
                name: "John Doe",
                email: "john@example.com",
                age: 30
            };

            const created = yield* collection.create(user);
            expect(created).toEqual(user);
            
            // Wait for background write (eventual consistency)
            yield* Effect.sleep("100 millis");

            const fetched = yield* collection.findById("1");
            expect(fetched).toEqual(user);
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

  it("should find documents with query options", async () => {
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
                { id: "1", name: "Alice", age: 25, email: "alice@example.com" },
                { id: "2", name: "Bob", age: 30, email: "bob@example.com" },
                { id: "3", name: "Charlie", age: 35, email: "charlie@example.com" },
                { id: "4", name: "David", age: 30, email: "david@example.com" }
            ];

            for (const u of users) {
                yield* collection.create(u);
            }
            
            // Wait for background writes
            yield* Effect.sleep("200 millis");

            // Test Find All
            const all = yield* collection.find({});
            expect(all.length).toBe(4);

            // Test Filter (Where)
            const age30 = yield* collection.find({ where: { age: 30 } });
            expect(age30.length).toBe(2);
            expect(age30.map(u => u.name).sort()).toEqual(["Bob", "David"]);

            // Test Limit
            const limited = yield* collection.find({ limit: 2 });
            expect(limited.length).toBe(2);

            // Test Sort
            const sorted = yield* collection.find({ order_by: { field: "age", order: "desc" } });
            expect(sorted[0].name).toBe("Charlie");
            expect(sorted[3].name).toBe("Alice");

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
});
