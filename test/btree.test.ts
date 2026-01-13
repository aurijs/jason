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
});