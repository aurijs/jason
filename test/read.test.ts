import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src/core/main";
import type { TestCollections } from "./types";
import { Document } from "../src/types";

const testFilename = "test_read_db";
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

function testReadSuite<T extends keyof TestCollections>(
  collectionName: T,
  validData: Document<TestCollections, T>,
  updateData: Partial<Document<TestCollections, T>>
) {
  describe(`${String(collectionName)} - READ`, () => {
    it("should read an existing document", async () => {
      const collection = db.collection(collectionName);
      const created = await collection.create(validData);
      const retrieved = await collection.read(created.id);

      expect(retrieved).toMatchObject(validData);
    });

    it("should return null for non-existent document", async () => {
      const collection = db.collection(collectionName);
      expect(await collection.read("non-existent-id")).toBeNull();
    });

    it("should return null after document deletion", async () => {
      const collection = db.collection(collectionName);
      const created = await collection.create(validData);

      await collection.delete(created.id);
      expect(await collection.read(created.id)).toBeNull();
    });

    it("should handle special characters in document ID", async () => {
      const collection = db.collection(collectionName);
      const id = "id!@#$%^&*()_+-=[]{}|;:',<>?~`";
      await collection.create({ ...validData, id });

      const retrieved = await collection.read(id);
      expect(retrieved?.id).toBe(id);
    });

    it("should handle long document IDs", async () => {
      const collection = db.collection(collectionName);
      const id = "a".repeat(128);
      await collection.create({ ...validData, id });

      const retrieved = await collection.read(id);
      expect(retrieved?.id).toBe(id);
    });

    it("should return latest version after update", async () => {
      const collection = db.collection(collectionName);
      const created = await collection.create(validData);
      await collection.update(created.id, updateData);
      const retrieved = await collection.read(created.id);
      expect(retrieved).toMatchObject({ ...validData, ...updateData });
    });

    it("should respect document ID case sensitivity", async () => {
      const collection = db.collection(collectionName);
      const id = "CaseSensitiveID";
      await collection.create({ ...validData, id });

      expect(await collection.read(id.toLowerCase())).toBeNull();
    });
  });
}

testReadSuite(
  "users",
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  } as any,
  { name: "Updated Name", age: 31 }
);

testReadSuite(
  "posts",
  {
    id: "1",
    title: "Original Title",
    content: "Original Content",
    authorId: "author1",
  } as any,
  { title: "Updated Title", content: "Updated Content" }
);
