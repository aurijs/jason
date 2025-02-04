import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import { Document } from "../src/types";
import type { TestCollections } from "./types";

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

it("should apply skip and limit in readAll", async () => {
  const users = db.collection("users");

  for (let i = 1; i <= 5; i++) {
    await users.create({
      id: String(i),
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + i,
    });
  }

  const allUsers = await users.readAll();
  expect(allUsers.length).toBe(5);
  expect(allUsers.map((u) => u.id)).toEqual(["1", "2", "3", "4", "5"]);

  const limited = await users.readAll({ limit: 2 });
  expect(limited.length).toBe(2);
  expect(limited.map((u) => u.id)).toEqual(["1", "2"]);

  const skipped = await users.readAll({ skip: 3 });
  expect(skipped.length).toBe(2);
  expect(skipped.map((u) => u.id)).toEqual(["4", "5"]);

  const combined = await users.readAll({ skip: 1, limit: 2 });
  expect(combined.length).toBe(2);
  expect(combined.map((u) => u.id)).toEqual(["2", "3"]);
});

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
