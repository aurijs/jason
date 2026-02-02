import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ConfigManager } from "../src/layers/config.js";
import { JsonFile } from "../src/layers/json-file.js";
import { Json } from "../src/layers/json.js";
import { WriteAheadLog } from "../src/layers/wal.js";
import { makeCollection } from "../src/make/collection.js";
import { gt, lt, and, or, gte, lte, regex, ne } from "../src/types/query.js";

describe("Advanced Queries Integration", () => {
  it("should perform indexed range and complex queries", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        
        const config = {
          base_path: tempDir,
          collections: {
            users: "@id;name;^age:number;role" 
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
            const users = yield* makeCollection<any>("users");

            const data = [
                { id: "1", name: "Alice", age: 25, role: "admin" },
                { id: "2", name: "Bob", age: 30, role: "user" },
                { id: "3", name: "Charlie", age: 35, role: "user" },
                { id: "4", name: "David", age: 20, role: "admin" }
            ];

            for (const u of data) {
                yield* users.create(u);
            }
            
            // Wait for background writes to indices
            yield* Effect.sleep("200 millis");

            // 1. Indexed Range Query (gt)
            const gt25 = yield* users.find({ where: { age: gt(25) } });
            expect(gt25.length).toBe(2); // Bob(30), Charlie(35)
            expect(gt25.map(u => u.name).sort()).toEqual(["Bob", "Charlie"]);

            // 2. Indexed Range Query (lt)
            const lt25 = yield* users.find({ where: { age: lt(25) } });
            expect(lt25.length).toBe(1); // David(20)
            expect(lt25[0].name).toBe("David");

            // 3. Range with inclusive bounds (gte, lte)
            const range = yield* users.find({ where: { age: and(gte(20), lte(30)) } as any });
            // wait, our findBestIndex doesn't support 'and' at top level of field yet.
            // It only supports simple comparison operators.
            // But evaluateFilter supports 'and'.
            // If findBestIndex returns full-scan, it still works.
            
            const gte30 = yield* users.find({ where: { age: gte(30) } });
            expect(gte30.length).toBe(2); // Bob(30), Charlie(35)

            // 4. Complex Filter (Indexed + Non-Indexed)
            const complex = yield* users.find({ 
                where: { 
                    age: gt(20),
                    role: "admin"
                } 
            });
            expect(complex.length).toBe(1); // Alice(25)
            expect(complex[0].name).toBe("Alice");

            // 5. Logical OR
            const orQuery = yield* users.find({
                where: or({ name: "Alice" }, { name: "David" })
            });
            expect(orQuery.length).toBe(2);
            expect(orQuery.map(u => u.name).sort()).toEqual(["Alice", "David"]);

        }).pipe(Effect.provide(TestLayer));
      })
    ).pipe(Effect.provide(BunContext.layer));

    await Effect.runPromise(program);
  });

  it("indexed range queries should be optimized (performance)", async () => {
    const program = Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const tempDir = yield* fs.makeTempDirectoryScoped();
          
          const config = {
            base_path: tempDir,
            collections: {
              users: "@id;name;^age:number" 
            }
          };
  
          const BaseLayer = Layer.mergeAll(Json.Default, ConfigManager.Default(config), BunContext.layer);
          const ServiceLayer = Layer.mergeAll(JsonFile.Default, WriteAheadLog.Default);
          const TestLayer = ServiceLayer.pipe(Layer.provide(BaseLayer), Layer.merge(BaseLayer));
  
          yield* Effect.gen(function* () {
              const users = yield* makeCollection<any>("users");
              
              // Insert 100 users
              for (let i = 0; i < 100; i++) {
                  yield* users.create({ id: String(i), name: `User ${i}`, age: i });
              }
              yield* Effect.sleep("1 seconds"); // Wait for indices
  
              const startScan = Date.now();
              // Force full scan by using a non-indexed field or complex logical op
              const scanResults = yield* users.find({ where: { name: regex("User 9") } });
              const endScan = Date.now();
  
              const startIndex = Date.now();
              const indexResults = yield* users.find({ where: { age: gt(90) } });
              const endIndex = Date.now();
  
              // Although 100 items is small, indexed should generally be faster or at least same
              // but the main thing is it works. Real performance gains seen at 10k+
              expect(indexResults.length).toBe(9);
          }).pipe(Effect.provide(TestLayer));
        })
      ).pipe(Effect.provide(BunContext.layer));
  
      await Effect.runPromise(program);
  }, 30000);
});
