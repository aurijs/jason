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

        // 1. Check Key Sorting
        for (let i = 0; i < node.keys.length - 1; i++) {
          if (node.keys[i] >= node.keys[i + 1]) {
             yield* Effect.fail(new Error(`Node ${nodeId} keys not sorted: ${node.keys}`));
          }
        }

        // 2. Check Occupancy
        // Root is exception
        if (nodeId !== rootId) {
             if (node.keys.length < order - 1) {
                 yield* Effect.fail(new Error(`Node ${nodeId} underflow. Keys: ${node.keys.length}, Min: ${order - 1}`));
             }
        }
        if (node.keys.length > 2 * order - 1) {
             yield* Effect.fail(new Error(`Node ${nodeId} overflow. Keys: ${node.keys.length}, Max: ${2 * order - 1}`));
        }

        if (node.is_leaf) {
            return depth;
        } else {
            // Check children count
            if (node.children.length !== node.keys.length + 1) {
                yield* Effect.fail(new Error(`Node ${nodeId} children count mismatch. Keys: ${node.keys.length}, Children: ${node.children.length}`));
            }

            let firstChildDepth = -1;

            for (let i = 0; i < node.children.length; i++) {
                const childDepth = yield* validateNode(node.children[i], depth + 1);
                if (firstChildDepth === -1) {
                    firstChildDepth = childDepth;
                } else if (childDepth !== firstChildDepth) {
                    yield* Effect.fail(new Error(`Node ${nodeId} unbalanced. Child ${i} depth ${childDepth} != ${firstChildDepth}`));
                }
                
                // Check separator property
                const childNode = yield* readNode(node.children[i]);
                
                if (i < node.keys.length) {
                    // child[i] keys < node.keys[i]
                    // We check the largest key in child[i]
                    const maxChildKey = childNode.keys[childNode.keys.length - 1];
                    if (maxChildKey >= node.keys[i]) {
                        yield* Effect.fail(new Error(`Node ${nodeId} separator violation. Child ${i} max key ${maxChildKey} >= Separator ${node.keys[i]}`));
                    }
                }
                
                if (i > 0) {
                     // child[i] keys > node.keys[i-1]
                     // We check the smallest key in child[i]
                     const minChildKey = childNode.keys[0];
                     if (minChildKey <= node.keys[i-1]) {
                         yield* Effect.fail(new Error(`Node ${nodeId} separator violation. Child ${i} min key ${minChildKey} <= Separator ${node.keys[i-1]}`));
                     }
                }
            }
            return firstChildDepth;
        }
      });

    yield* validateNode(rootId, 0);
  });

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

        const val1 = yield* btree.find("key1");
        const val2 = yield* btree.find("key2");
        const val3 = yield* btree.find("key3");
        const val4 = yield* btree.find("key4");

        return { val1, val2, val3, val4 };
      })
    ).pipe(Effect.provide(BunContext.layer));

    const { val1, val2, val3, val4 } = await Effect.runPromise(program);
    expect(val1).toBe("value1");
    expect(val2).toBe("value2");
    expect(val3).toBe("value3");
    expect(val4).toBeUndefined();
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

        const valA = yield* btree.find("a");
        const valB = yield* btree.find("b");
        const valC = yield* btree.find("c");
        const valD = yield* btree.find("d");
        
        return { valA, valB, valC, valD };
      })
    ).pipe(Effect.provide(BunContext.layer));

    const { valA, valB, valC, valD } = await Effect.runPromise(program);
    expect(valA).toBe("1");
    expect(valB).toBe("2");
    expect(valC).toBe("3");
    expect(valD).toBe("4");
  });

  it("should maintain valid tree structure", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);

    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 2;
        
        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          order
        );

        yield* btree.insert("a", "1");
        yield* btree.insert("b", "2");
        yield* btree.insert("c", "3");
        yield* btree.insert("d", "4");
        yield* btree.insert("e", "5"); 

        yield* validateTree(fs, tempDir, Schema.String, order);
      })
    ).pipe(Effect.provide(TestLayer));
    await Effect.runPromise(program);
  });

  it("should delete keys from leaf nodes", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
    
    const program = Effect.scoped(
      Effect.gen(function* () {
         const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 3;
        
        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          order
        );
        
        yield* btree.insert("key1", "val1");
        yield* btree.insert("key2", "val2");
        yield* btree.insert("key3", "val3");
        
        // 1. Delete non-existent
        const deletedMissing = yield* btree.delete("missing");
        if (deletedMissing !== false) {
             yield* Effect.fail(new Error("Expected delete('missing') to return false"));
        }
        
        // 2. Delete existing leaf key
        const deleted = yield* btree.delete("key2");
        if (deleted !== true) {
             yield* Effect.fail(new Error("Expected delete('key2') to return true"));
        }
        
        const val = yield* btree.find("key2");
        if (val !== undefined) {
             yield* Effect.fail(new Error("Expected 'key2' to be gone"));
        }

        // Validate structure
        yield* validateTree(fs, tempDir, Schema.String, order);
      })
    ).pipe(Effect.provide(TestLayer));
    
    await Effect.runPromise(program);
  });

  it("should delete keys from internal nodes", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
    
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 2;
        
        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          order
        );
        
        // Force an internal node to have keys.
        // Order 2 means max 3 keys per node.
        // Root split will create an internal node.
        yield* btree.insert("b", "val-b");
        yield* btree.insert("d", "val-d");
        yield* btree.insert("f", "val-f");
        yield* btree.insert("h", "val-h"); // This should cause split. 'd' should go to root.
        
        // 'd' is likely in the root (internal node if height > 1)
        const deleted = yield* btree.delete("d");
        const valD = yield* btree.find("d");
        
        // Check other keys are still there
        const valB = yield* btree.find("b");
        const valF = yield* btree.find("f");
        const valH = yield* btree.find("h");

        // Validate structure
        yield* validateTree(fs, tempDir, Schema.String, order);
        
        return { deleted, valD, valB, valF, valH };
      })
    ).pipe(Effect.provide(TestLayer));
    
    const { deleted, valD, valB, valF, valH } = await Effect.runPromise(program);
    expect(deleted).toBe(true);
    expect(valD).toBeUndefined();
    expect(valB).toBe("val-b");
    expect(valF).toBe("val-f");
    expect(valH).toBe("val-h");
  });

  it("should rebalance by borrowing from sibling", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
    
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 3; // Min keys = 2
        
        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          order
        );
        
        // Setup a situation where we can borrow.
        // Root: [d]
        // Child0: [a, b, c] (can spare one)
        // Child1: [e, f] (at minimum)
        yield* btree.insert("d", "4");
        yield* btree.insert("a", "1");
        yield* btree.insert("b", "2");
        yield* btree.insert("c", "3");
        yield* btree.insert("e", "5");
        yield* btree.insert("f", "6");
        
        // Deleting 'f' makes Child1 have 1 key (underflow).
        // It should borrow from Child0.
        const deleted = yield* btree.delete("f");
        const valF = yield* btree.find("f");
        
        // Validate all other keys
        const others: Record<string, string | undefined> = {};
        for (const k of ["a", "b", "c", "d", "e"]) {
            others[k] = yield* btree.find(k);
        }

        // Validate structure
        yield* validateTree(fs, tempDir, Schema.String, order);

        return { deleted, valF, others };
      })
    ).pipe(Effect.provide(TestLayer));
    
    const { deleted, valF, others } = await Effect.runPromise(program);
    expect(deleted).toBe(true);
    expect(valF).toBeUndefined();
    for (const k of ["a", "b", "c", "d", "e"]) {
        expect(others[k]).toBeDefined();
    }
  });

  it("should rebalance by merging nodes", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
    
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 3; // Min keys = 2
        
        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          order
        );
        
        // Setup: Root [d], Child0 [b, c], Child1 [e, f]
        yield* btree.insert("d", "4");
        yield* btree.insert("b", "2");
        yield* btree.insert("c", "3");
        yield* btree.insert("e", "5");
        yield* btree.insert("f", "6");
        
        // Both children are at minimum (2 keys).
        // Deleting 'f' should trigger merge of Child0 and Child1.
        const deleted = yield* btree.delete("f");
        
        // Validate all other keys
        const others: Record<string, string | undefined> = {};
        for (const k of ["b", "c", "d", "e"]) {
            others[k] = yield* btree.find(k);
        }

        // Validate structure
        yield* validateTree(fs, tempDir, Schema.String, order);

        return { deleted, others };
      })
    ).pipe(Effect.provide(TestLayer));
    
    const { deleted, others } = await Effect.runPromise(program);
    expect(deleted).toBe(true);
    for (const k of ["b", "c", "d", "e"]) {
        expect(others[k]).toBeDefined();
    }
  });

  it("should reduce tree height when root becomes empty", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
    
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 2; // Max 3 keys per node.
        
        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          order
        );
        
        // Setup height 2 tree.
        // Insert enough to cause a split and have root with 1 key.
        yield* btree.insert("a", "1");
        yield* btree.insert("b", "2");
        yield* btree.insert("c", "3");
        yield* btree.insert("d", "4"); 
        // Root now likely has 'b' or 'c'. Children are [a] and [c, d] or [a, b] and [d].
        
        // Delete until root needs to be merged and height reduced.
        yield* btree.delete("a");
        yield* btree.delete("b");
        yield* btree.delete("c");
        yield* btree.delete("d");

        const valA = yield* btree.find("a");
        
        // Validate structure
        yield* validateTree(fs, tempDir, Schema.String, order);

        return { valA };
      })
    ).pipe(Effect.provide(TestLayer));
    
    const { valA } = await Effect.runPromise(program);
    expect(valA).toBeUndefined();
  });

  it("should maintain invariants during randomized operations", async () => {
    const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
    
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const order = 2;
        
        const btree = yield* makeBtreeService(
          tempDir,
          Schema.String,
          order
        );
        
        const keys = Array.from({ length: 50 }, (_, i) => `key-${i.toString().padStart(2, "0")}`);
        
        // 1. Random Inserts
        const shuffledInserts = [...keys].sort(() => Math.random() - 0.5);
        for (const key of shuffledInserts) {
            yield* btree.insert(key, `val-${key}`);
            yield* validateTree(fs, tempDir, Schema.String, order);
        }
        
        // 2. Random Deletes
        const shuffledDeletes = [...keys].sort(() => Math.random() - 0.5);
        const deleteResults: Record<string, { deleted: boolean, foundAfter: string | undefined }> = {};
        for (const key of shuffledDeletes) {
            const deleted = yield* btree.delete(key);
            const foundAfter = yield* btree.find(key);
            deleteResults[key] = { deleted, foundAfter };
            yield* validateTree(fs, tempDir, Schema.String, order);
        }

        return { shuffledDeletes, deleteResults };
      })
    ).pipe(Effect.provide(TestLayer));
    
    const { shuffledDeletes, deleteResults } = await Effect.runPromise(program);
    for (const key of shuffledDeletes) {
        expect(deleteResults[key].deleted).toBe(true);
        expect(deleteResults[key].foundAfter).toBeUndefined();
    }
  }, 30000);

  describe("Range Queries", () => {
    it("should find keys in range", async () => {
        const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
        const program = Effect.scoped(
            Effect.gen(function* () {
                const fs = yield* FileSystem.FileSystem;
                const tempDir = yield* fs.makeTempDirectoryScoped();
                const btree = yield* makeBtreeService(tempDir, Schema.String, 3);
                
                const keys = ["10", "20", "30", "40", "50"];
                for (const k of keys) yield* btree.insert(k, `val-${k}`);
                
                // @ts-ignore
                const results = yield* btree.findRange({ min: "20", max: "40" });
                return results;
            })
        ).pipe(Effect.provide(TestLayer));

        const results = await Effect.runPromise(program);
        expect(results.map(r => r.key)).toEqual(["20", "30", "40"]);
    });

    it("should respect exclusive bounds", async () => {
        const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
        const program = Effect.scoped(
            Effect.gen(function* () {
                const fs = yield* FileSystem.FileSystem;
                const tempDir = yield* fs.makeTempDirectoryScoped();
                const btree = yield* makeBtreeService(tempDir, Schema.String, 3);
                
                const keys = ["10", "20", "30", "40", "50"];
                for (const k of keys) yield* btree.insert(k, `val-${k}`);
                
                // @ts-ignore
                const results = yield* btree.findRange({ min: "20", max: "40", minInclusive: false, maxInclusive: false });
                return results;
            })
        ).pipe(Effect.provide(TestLayer));

        const results = await Effect.runPromise(program);
        expect(results.map(r => r.key)).toEqual(["30"]);
    });

    it("should work without lower bound (lt/lte)", async () => {
        const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
        const program = Effect.scoped(
            Effect.gen(function* () {
                const fs = yield* FileSystem.FileSystem;
                const tempDir = yield* fs.makeTempDirectoryScoped();
                const btree = yield* makeBtreeService(tempDir, Schema.String, 3);
                
                const keys = ["10", "20", "30", "40", "50"];
                for (const k of keys) yield* btree.insert(k, `val-${k}`);
                
                // @ts-ignore
                const results = yield* btree.findRange({ max: "20" });
                return results;
            })
        ).pipe(Effect.provide(TestLayer));

        const results = await Effect.runPromise(program);
        expect(results.map(r => r.key)).toEqual(["10", "20"]);
    });

    it("should work without upper bound (gt/gte)", async () => {
        const TestLayer = Layer.mergeAll(Json.Default, BunContext.layer);
        const program = Effect.scoped(
            Effect.gen(function* () {
                const fs = yield* FileSystem.FileSystem;
                const tempDir = yield* fs.makeTempDirectoryScoped();
                const btree = yield* makeBtreeService(tempDir, Schema.String, 3);
                
                const keys = ["10", "20", "30", "40", "50"];
                for (const k of keys) yield* btree.insert(k, `val-${k}`);
                
                // @ts-ignore
                const results = yield* btree.findRange({ min: "40" });
                return results;
            })
        ).pipe(Effect.provide(TestLayer));

        const results = await Effect.runPromise(program);
        expect(results.map(r => r.key)).toEqual(["40", "50"]);
    });
  });
});