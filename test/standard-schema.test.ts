import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { createJasonDB } from "../src/core/main.js";
import type { StandardSchemaV1 } from "../src/types/schema.js";

// Simple Standard Schema implementation for testing
const SimpleUserSchema: StandardSchemaV1<any, { id: string; name: string; age: number }> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value: any) => {
      if (typeof value !== "object" || value === null) {
        return { issues: [{ message: "Not an object" }] };
      }
      if (typeof value.id !== "string") {
        return { issues: [{ message: "Invalid ID" }] };
      }
      if (typeof value.name !== "string") {
        return { issues: [{ message: "Invalid name" }] };
      }
      if (typeof value.age !== "number") {
        return { issues: [{ message: "Invalid age" }] };
      }
      return { value: value as { id: string; name: string; age: number } };
    }
  }
};

describe("Standard Schema Support", () => {
  it("should validate documents using a standard schema", async () => {
    const fs = await Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(BunContext.layer)));
    const tempDir = await Effect.runPromise(Effect.scoped(fs.makeTempDirectoryScoped()).pipe(Effect.provide(BunContext.layer)));
    
    const db = await createJasonDB({
      base_path: tempDir,
      collections: {
        users: SimpleUserSchema
      }
    });

    const { users } = db.collections;

    // Valid insert
    const user = { id: "1", name: "Alice", age: 30 };
    const created = await users.create(user);
    expect(created).toEqual(user);

    // Invalid insert
    try {
        await users.create({ id: "2", name: "Bob", age: "invalid" } as any);
        expect.fail("Should have thrown");
    } catch (error: any) {
        // console.log("ERROR TYPE:", error.constructor.name);
        // console.log("ERROR KEYS:", Object.keys(error));
        // console.log("ERROR TOSTRING:", error.toString());
        
        // In some versions of Effect, the error is the TaggedError directly
        // In others it might be wrapped.
        expect(error.message || error.toString()).toContain("Failed to create document");
        
        const cause = error.cause;
        if (cause) {
            expect(cause.message || cause.toString()).toContain("Validation failed: Invalid age");
        } else {
            expect(error.toString()).toContain("Validation failed: Invalid age");
        }
    }

    // Valid find
        const found = await users.findById("1");
        expect(found).toEqual(user);
    
        // Batch insert
        const results = await users.batch.insert([
            { id: "batch-1", name: "User 1", age: 20 },
            { id: "batch-2", name: "User 2", age: "invalid" } as any,
            { id: "batch-3", name: "User 3", age: 30 }
        ]);
    
        expect(results.success).toBe(2);
        expect(results.failures.length).toBe(1);
        expect(results.failures[0].error).toContain("Validation failed: Invalid age");
    
        await db[Symbol.asyncDispose]();
      });
    });
    