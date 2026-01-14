import { describe, it, expect } from "vitest";
import * as z from "zod";
import { createJasonDB } from "../src/core/main.js";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { BunContext } from "@effect/platform-bun";

describe("Standard Schema Integration (Zod)", () => {
  it("should validate documents using Zod schema", async () => {
    const userSchema = z.object({
      id: z.string(),
      name: z.string().min(3),
      age: z.number().int().positive(),
    });

    const db = await createJasonDB({
      base_path: `./tmp/test-db-${crypto.randomUUID()}`,
      collections: {
        users: userSchema,
      },
    });

    // 1. Successful creation
    const user = await db.collections.users.create({
      id: "user-1",
      name: "Alice",
      age: 30,
    });
    expect(user.name).toBe("Alice");

    // 2. Validation failure (name too short)
    try {
      await db.collections.users.create({
        id: "user-2",
        name: "Al",
        age: 25,
      });
      expect.fail("Should have thrown ValidationError");
    } catch (error: any) {
      // The error might be wrapped in FiberFailure or just be the error itself depending on how runPromise works
      expect(error.message).toContain("Validation failed");
    }

    // 3. Batch insertion with some failures
    const batchResult = await db.collections.users.batch.insert([
      { id: "user-3", name: "Bob", age: 40 },
      { id: "user-4", name: "Bo", age: 35 }, // Invalid name
    ]);

    expect(batchResult.success).toBe(1);
    expect(batchResult.failures).toHaveLength(1);
    expect(batchResult.failures[0].error).toContain("Validation failed");

    // 4. Update validation
    try {
      await db.collections.users.update("user-1", {
        age: -5, // Invalid age
      });
      expect.fail("Should have thrown ValidationError on update");
    } catch (error: any) {
      expect(error.message).toContain("Validation failed");
    }

    await db[Symbol.asyncDispose]();
  });
});