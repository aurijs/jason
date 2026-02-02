import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ConfigManager } from "../src/layers/config.js";
import * as path from'node:path'

describe("ConfigManager Service", () => {
  const testConfig = {
    base_path: "tmp/db",
    collections: {
      users: "@id;name;age:number",
      posts: Schema.Struct({ title: Schema.String, published: Schema.Boolean })
    }
  };

  const TestLayer = ConfigManager.Default(testConfig).pipe(
    Layer.provide(BunContext.layer)
  );

  it("should return the correct base path", async () => {
    const program = Effect.gen(function* () {
      const configManager = yield* ConfigManager;
      return yield* configManager.getBasePath;
    });

    const basePath = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(basePath).toBe("tmp/db");
  });

  it("should return the correct collection path", async () => {
    const program = Effect.gen(function* () {
      const configManager = yield* ConfigManager;
      return yield* configManager.getCollectionPath("users");
    });

    const collectionPath = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(collectionPath).toBe(path.join("tmp/db/users"));
  });

  it("should build a schema from a string definition", async () => {
    const program = Effect.gen(function* () {
      const configManager = yield* ConfigManager;
      return yield* configManager.getCollectionSchema("users");
    });

    const schema = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    const expectedSchema = Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      age: Schema.Number
    });

    expect(schema.ast).toEqual(expectedSchema.ast);
  });

  it("should return the original schema if it's not a string", async () => {
    const program = Effect.gen(function* () {
      const configManager = yield* ConfigManager;
      return yield* configManager.getCollectionSchema("posts");
    });

    const schema = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(schema.ast).toEqual(testConfig.collections.posts.ast);
  });

  it("should build correct index definitions from a string schema", async () => {
    const program = Effect.gen(function* () {
      const configManager = yield* ConfigManager;
      return yield* configManager.getIndexDefinitions("users");
    });

    const indexDefs = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(indexDefs).toEqual(
      expect.objectContaining({
        id: expect.objectContaining({
          unique: true,
          primary_key: true,
          uuid: true
        }),
        name: expect.objectContaining({
          unique: false
        }),
        age: expect.objectContaining({
          unique: false
        })
      })
    );
  });
});
