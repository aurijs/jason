import { parse } from "devalue";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import type { TestCollections } from "./types";

const testFilename = "test_update_db";
const filePath = path.join(process.cwd(), testFilename);
let db: JasonDB<TestCollections>;

beforeEach(() => {
  db = new JasonDB(testFilename);
});

afterEach(async () => {
  try {
    await rm(filePath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Error cleaning up test directory:", error);
      throw error;
    }
  }
});

const createData = {
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  age: 30,
};

const updateData = {
  name: "Updated Name",
  age: 35,
  email: "updated@example.com",
};

describe("User - UPDATE", () => {
  it("should perform full document update", async () => {
    const collection = db.collection("users");
    const created = await collection.create(createData);
    const updated = await collection.update(created.id, updateData);

    expect(updated).toMatchObject({ ...createData, ...updateData });
  });

  it("should perform partial update", async () => {
    const collection = db.collection("users");
    const created = await collection.create({ ...createData });
    // Construct partialUpdate without the 'id' property
    const { id: _removed, ...partialUpdate } = { ...createData, ...updateData };

    const updated = await collection.update(created.id, partialUpdate);
    expect(updated).toMatchObject({ ...created, ...partialUpdate });
  });

  it("should validate schema before update", async () => {
    const collection = db.collection("users", {
      schema: (doc) => typeof doc.age === "number",
    });
    const created = await collection.create({ ...createData });

    await expect(
      // @ts-expect-error
      collection.update(created.id, { age: "invalid-age" })
    ).rejects.toThrow("Document failed schema validation");
  });

  it("should update cache after successful update", async () => {
    const collection = db.collection("users");
    const created = await collection.create(createData);

    const beforeUpdate = await collection.read(created.id);

    await collection.update(created.id, updateData);
    const afterUpdate = await collection.read(created.id);

    expect(afterUpdate).toMatchObject(updateData);
    // Ensure beforeUpdate is not null before assertion
    if (beforeUpdate) {
      expect(afterUpdate).not.toMatchObject(beforeUpdate);
    } else {
      // Fail test if beforeUpdate was unexpectedly null
      expect(beforeUpdate).toBeDefined();
    }
  });

  it("should persist changes to disk", async () => {
    const collection = db.collection("users");
    const created = await collection.create({ ...createData });
    await collection.update(created.id, updateData);

    // Lê diretamente do arquivo
    // Use encoded ID for direct file path check
    const encodedId = Buffer.from(created.id).toString("base64url");
    const _filePath = path.join(filePath, "users", `${encodedId}.json`);
    const rawData = await readFile(_filePath, "utf-8");
    const diskData = parse(rawData);

    expect(diskData).toMatchObject(updateData);
  });

  it("should return null when updating deleted document", async () => {
    const collection = db.collection("users");
    const created = await collection.create({ ...createData });
    await collection.delete(created.id);

    const result = await collection.update(created.id, updateData);
    expect(result).toBeNull();
  });
});
