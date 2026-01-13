import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Json } from "../src/layers/json.js";
import { makeBtreeService, BTreeNodeSchema, RootPointerSchema } from "../src/make/btree.js";

const validateTree = <K>(
  fs: FileSystem.FileSystem,
  treePath: string,
  keySchema: Schema.Schema<any, K>,
  order: number
) =>
  Effect.gen(function* () {
    const jsonService = yield* Json;
    const nodeSchema = BTreeNodeSchema(keySchema);

    const readNode = (id: string) =>
      fs.readFileString(`${treePath}/${id}.json`).pipe(
        Effect.flatMap(jsonService.parse),
        Effect.flatMap((data) => Schema.decode(nodeSchema)(data))
      );

    const rootContent = yield* fs.readFileString(`${treePath}/_root.json`);
    const rootJson = yield* jsonService.parse(rootContent);
    const rootPointer = yield* Schema.decode(RootPointerSchema)(rootJson);
    const rootId = rootPointer.root_id;

    const validateNode = (nodeId: string, depth: number): Effect.Effect<number, any> =>
      Effect.gen(function* () {
        const node = yield* readNode(nodeId);

        // 1. Check Key Sorting (Allow duplicates now)
        for (let i = 0; i < node.keys.length - 1; i++) {
          if (node.keys[i] > node.keys[i + 1]) {
             yield* Effect.fail(new Error(`Node ${nodeId} keys not sorted: ${node.keys}`));
          }
        }

        // 2. Check Occupancy
        if (nodeId !== rootId) {
             if (node.keys.length < order - 1) {
                 yield* Effect.fail(new Error(`Node ${nodeId} underflow`));
             }
        }

        if (node.is_leaf) {
            return depth;
        } else {
            let firstChildDepth = -1;
            for (let i = 0; i < node.children.length; i++) {
                const childDepth = yield* validateNode(node.children[i], depth + 1);
                if (firstChildDepth === -1) firstChildDepth = childDepth;
                else if (childDepth !== firstChildDepth) yield* Effect.fail(new Error("Unbalanced"));
                
                const childNode = yield* readNode(node.children[i]);
                if (i < node.keys.length) {
                    const maxChildKey = childNode.keys[childNode.keys.length - 1];
                    if (maxChildKey > node.keys[i]) yield* Effect.fail(new Error("Separator violation"));
                }
                if (i > 0) {
                     const minChildKey = childNode.keys[0];
                     if (minChildKey < node.keys[i-1]) yield* Effect.fail(new Error("Separator violation"));
                }
            }
            return firstChildDepth;
        }
      });

    yield* validateNode(rootId, 0);
  });

describe("BTree Non-Unique Indexes", () => {
  it("should store duplicate keys and find returns one of them", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);

    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 2;

        const btree = yield* makeBtreeService(tempDir, Schema.String, order);

        yield* btree.insert("key1", "value1-a");
        yield* btree.insert("key1", "value1-b");

        const val = yield* btree.find("key1");
        
        // Verify both values are actually in the tree files
        const jsonService = yield* Json;
        const nodeSchema = BTreeNodeSchema(Schema.String);
        
        const files = yield* fs.readDirectory(tempDir);
        let foundA = false;
        let foundB = false;
        
        for (const file of files) {
            if (file.endsWith(".json") && file !== "_root.json") {
                const content = yield* fs.readFileString(`${tempDir}/${file}`);
                const json = yield* jsonService.parse(content);
                const node = yield* Schema.decode(nodeSchema)(json);
                if (node.values.includes("value1-a")) foundA = true;
                if (node.values.includes("value1-b")) foundB = true;
            }
        }

        yield* validateTree(fs, tempDir, Schema.String, order);

        return { val, foundA, foundB };
      })
    ).pipe(Effect.provide(TestLayer));

    const { val, foundA, foundB } = await Effect.runPromise(program);
    expect(foundA).toBe(true);
    expect(foundB).toBe(true);
    expect(["value1-a", "value1-b"]).toContain(val);
  });

  it("findAll should retrieve all values for a key", async () => {
      const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);

      const program = Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const tempDir = yield* fs.makeTempDirectoryScoped();
          const btree = yield* makeBtreeService(tempDir, Schema.String, 2);
          
          yield* btree.insert("key1", "value1-a");
          yield* btree.insert("key1", "value1-b");
          yield* btree.insert("key2", "value2");

          // @ts-ignore
          const results = yield* btree.findAll("key1");
          return results;
        })
      ).pipe(Effect.provide(TestLayer));

      const results = await Effect.runPromise(program);
      expect(results).toContain("value1-a");
      expect(results).toContain("value1-b");
      expect(results.length).toBe(2);
  });

  it("findAll should work with many duplicates across multiple nodes", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);

    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 2; // small order
        const btree = yield* makeBtreeService(tempDir, Schema.String, order);
        
        // Insert 10 duplicates
        for (let i = 0; i < 10; i++) {
            yield* btree.insert("dup", `val-${i}`);
        }
        
        yield* btree.insert("before", "low");
        yield* btree.insert("after", "high");

        const results = yield* btree.findAll("dup");
        yield* validateTree(fs, tempDir, Schema.String, order);
        return results;
      })
    ).pipe(Effect.provide(TestLayer));

    const results = await Effect.runPromise(program);
    expect(results.length).toBe(10);
    for (let i = 0; i < 10; i++) {
        expect(results).toContain(`val-${i}`);
    }
  });

  describe("Precise Deletion", () => {
    it("delete(key, value) should remove only specific value", async () => {
        const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
        const program = Effect.scoped(
            Effect.gen(function* () {
                const fs = yield* FileSystem.FileSystem;
                const tempDir = yield* fs.makeTempDirectoryScoped();
                const btree = yield* makeBtreeService(tempDir, Schema.String, 2);
                
                yield* btree.insert("key1", "val-a");
                yield* btree.insert("key1", "val-b");
                
                const deleted = yield* btree.delete("key1", "val-a");
                const results = yield* btree.findAll("key1");
                
                return { deleted, results };
            })
        ).pipe(Effect.provide(TestLayer));

        const { deleted, results } = await Effect.runPromise(program);
        expect(deleted).toBe(true);
        expect(results).toEqual(["val-b"]);
    });

    it("delete(key) should remove the first occurrence", async () => {
        const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
        const program = Effect.scoped(
            Effect.gen(function* () {
                const fs = yield* FileSystem.FileSystem;
                const tempDir = yield* fs.makeTempDirectoryScoped();
                const btree = yield* makeBtreeService(tempDir, Schema.String, 2);
                
                yield* btree.insert("key1", "val-a");
                yield* btree.insert("key1", "val-b");
                
                const deleted = yield* btree.delete("key1");
                const results = yield* btree.findAll("key1");
                
                return { deleted, results };
            })
        ).pipe(Effect.provide(TestLayer));

        const { deleted, results } = await Effect.runPromise(program);
        expect(deleted).toBe(true);
        expect(results.length).toBe(1);
        expect(["val-a", "val-b"]).toContain(results[0]);
    });
  });

  it("should maintain invariants during randomized duplicate operations", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
    const program = Effect.scoped(
        Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const tempDir = yield* fs.makeTempDirectoryScoped();
            const order = 2;
            const btree = yield* makeBtreeService(tempDir, Schema.String, order);
            
            const count = 100;
            const key = "constant-key";
            const values = Array.from({ length: count }, (_, i) => `val-${i}`);
            
            // 1. Insert many duplicates
            for (const val of values) {
                yield* btree.insert(key, val);
            }
            yield* validateTree(fs, tempDir, Schema.String, order);
            
            // 2. Randomly delete half by value
            const shuffled = [...values].sort(() => Math.random() - 0.5);
            const toDelete = shuffled.slice(0, count / 2);
            const toKeep = shuffled.slice(count / 2);
            
            for (const val of toDelete) {
                const deleted = yield* btree.delete(key, val);
                expect(deleted).toBe(true);
                yield* validateTree(fs, tempDir, Schema.String, order);
            }
            
            // 3. Verify remaining
            const remaining = yield* btree.findAll(key);
            expect(remaining.length).toBe(toKeep.length);
            for (const val of toKeep) {
                expect(remaining).toContain(val);
            }
            for (const val of toDelete) {
                expect(remaining).not.toContain(val);
            }
        })
    ).pipe(Effect.provide(TestLayer));

    await Effect.runPromise(program);
  }, 30000);
});