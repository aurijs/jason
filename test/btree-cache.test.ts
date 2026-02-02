import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { Json } from "../src/layers/json.js";
import { makeBtreeService } from "../src/make/btree.js";

describe("BTree Node Caching", () => {
  it("should cache node read results", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        
        const TestLayer = Layer.mergeAll(
            Json.Default,
            BunContext.layer
        );

        yield* Effect.gen(function* () {
            const btree = yield* makeBtreeService(
              tempDir,
              Schema.String,
              3,
              10
            );
            const json = yield* Json;
            
            // Spy on json.parse
            const parseSpy = vi.spyOn(json, 'parse');

            yield* btree.insert("key1", "val1");
            
            // First find
            yield* btree.find("key1");
            const calls1 = parseSpy.mock.calls.length;
            expect(calls1).toBeGreaterThan(0);

            parseSpy.mockClear();
            // Second find
            yield* btree.find("key1");
            expect(parseSpy).toHaveBeenCalledTimes(0); 

            parseSpy.mockRestore();
        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(
        Effect.provide(BunContext.layer)
    );

    await Effect.runPromise(program);
  });
});
