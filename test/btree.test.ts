import { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Json } from "../src/layers/json.js";
import { makeBtreeService } from "../src/make/btree.js";

describe("BTree Service", () => {
  it("should insert and find keys", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();

        const TestLayer = Layer.mergeAll(
          Json.Default,
          BunContext.layer
        );

        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          3 // order
        ).pipe(Effect.provide(TestLayer));

        yield* btree.insert("key1", "value1");
        yield* btree.insert("key2", "value2");
        yield* btree.insert("key3", "value3");

        expect(yield* btree.find("key1")).toBe("value1");
        expect(yield* btree.find("key2")).toBe("value2");
        expect(yield* btree.find("key3")).toBe("value3");
        expect(yield* btree.find("key4")).toBeUndefined();
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });

  it("should handle splits correctly", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();

        const TestLayer = Layer.mergeAll(
          Json.Default,
          BunContext.layer
        );

        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          2 // small order to force splits
        ).pipe(Effect.provide(TestLayer));

        // Max keys in node = 2*order - 1 = 3
        yield* btree.insert("a", "1");
        yield* btree.insert("b", "2");
        yield* btree.insert("c", "3");
        // Next insert should cause split
        yield* btree.insert("d", "4");

        expect(yield* btree.find("a")).toBe("1");
        expect(yield* btree.find("b")).toBe("2");
        expect(yield* btree.find("c")).toBe("3");
        expect(yield* btree.find("d")).toBe("4");
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });
});
