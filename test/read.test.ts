import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import type { Document } from "../src/types";
import type { TestCollections, TestUser, TestPost } from "./types";

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
  validData: TestCollections[T][number], // Use the element type of the array
  updateData: Partial<TestCollections[T][number]> // Use the element type for partial updates
) {
  describe(`${String(collectionName)} - READ`, () => {
    it("should read an existing document", async () => {
      const collection = db.collection(collectionName);
      // Cast validData to the expected input type (Omit<DocumentType, 'id' | '_lastModified'> | DocumentType)
      // Since validData is now TestUser/TestPost, it fits the bill.
      const created = await collection.create(validData as any); // Cast needed due to complex generic inference issues
      const retrieved = await collection.read(created.id);

      expect(retrieved).toMatchObject(validData);
    });

    it("should return null for non-existent document", async () => {
      const collection = db.collection(collectionName);
      expect(await collection.read("non-existent-id")).toBeNull();
    });

    it("should return null after document deletion", async () => {
      const collection = db.collection(collectionName);
      const created = await collection.create(validData as any); // Cast needed

      await collection.delete(created.id);
      expect(await collection.read(created.id)).toBeNull();
    });

    // Increase timeout for potential slow filesystem operations with special chars
    it("should handle special characters in document ID", { timeout: 10000 }, async () => {
      const collection = db.collection(collectionName);
      const id = "id!@#$%^&*()_+-=[]{}|;:',<>?~`";
      // Ensure the base validData doesn't already have an 'id' conflicting
      // Construct object without id if it exists in validData
      const { id: _, ...dataWithoutId } = validData as any;
      const dataToCreate = { ...dataWithoutId };
      await collection.create({ ...dataToCreate, id });

      const retrieved = await collection.read(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(id);
      // Also check a property from the original data to ensure full retrieval
      if ('name' in validData && validData.name) {
        expect((retrieved as any)?.name).toBe((validData as any).name);
      } else if ('title' in validData && validData.title) {
         expect((retrieved as any)?.title).toBe((validData as any).title);
      }
    });

    it("should handle long document IDs", async () => {
      const collection = db.collection(collectionName);
      const id = "a".repeat(128);
      await collection.create({ ...validData, id } as any); // Cast needed

      const retrieved = await collection.read(id);
      expect(retrieved?.id).toBe(id);
    });

    it("should return latest version after update", async () => {
      const collection = db.collection(collectionName);
      // Casts still needed due to complex generic inference issues
      const created = await collection.create(validData as any);
      await collection.update(created.id, updateData as any);
      const retrieved = await collection.read(created.id);
      expect(retrieved).toMatchObject({ ...validData, ...updateData });
    });

    it("should respect document ID case sensitivity", async () => {
      const collection = db.collection(collectionName);
      const id = "CaseSensitiveID";
      await collection.create({ ...validData, id } as any); // Cast needed

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
  // Check content regardless of order
  expect(allUsers.map((u) => u.id)).toEqual(expect.arrayContaining(["1", "2", "3", "4", "5"]));

  const limited = await users.readAll({ limit: 2 });
  expect(limited.length).toBe(2);
  // Check content regardless of order - limit should take the first N based on typical read order
  expect(limited.map((u) => u.id)).toEqual(expect.arrayContaining(["1", "2"]));

  const skipped = await users.readAll({ skip: 3 });
  expect(skipped.length).toBe(2); // 5 total - skip 3 = 2 remaining
  // Check content regardless of order - skip should ignore the first N based on typical read order
  expect(skipped.map((u) => u.id)).toEqual(expect.arrayContaining(["4", "5"]));

  const combined = await users.readAll({ skip: 1, limit: 2 });
  expect(combined.length).toBe(2);
  // Check content regardless of order - skip 1, limit 2
  expect(combined.map((u) => u.id)).toEqual(expect.arrayContaining(["2", "3"]));
});

it("should ignore _metadata.json", async () => {
  const users = db.collection("users", {
    generateMetadata: true,
  });

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
  // Check content regardless of order
  expect(allUsers.map((u) => u.id)).toEqual(expect.arrayContaining(["1", "2", "3", "4", "5"]));

  const limited = await users.readAll({ limit: 2 });
  expect(limited.length).toBe(2);
  // Check content regardless of order - limit should take the first N
  expect(limited.map((u) => u.id)).toEqual(expect.arrayContaining(["1", "2"]));

  const skipped = await users.readAll({ skip: 3 });
  expect(skipped.length).toBe(2); // 5 total - skip 3 = 2 remaining
  // Check content regardless of order - skip should ignore the first N
  expect(skipped.map((u) => u.id)).toEqual(expect.arrayContaining(["4", "5"]));

  const combined = await users.readAll({ skip: 1, limit: 2 });
  expect(combined.length).toBe(2);
  // Check content regardless of order - skip 1, limit 2
  expect(combined.map((u) => u.id)).toEqual(expect.arrayContaining(["2", "3"]));
});

// Define test data conforming to TestUser and TestPost interfaces
const userTestData: TestUser = {
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  age: 30,
};
const userUpdateData: Partial<TestUser> = { name: "Updated Name", age: 31 };

testReadSuite("users", userTestData, userUpdateData);

const postTestData: TestPost = {
  id: "1",
  title: "Original Title",
  content: "Original Content",
  authorId: "author1",
};
const postUpdateData: Partial<TestPost> = { title: "Updated Title", content: "Updated Content" };

testReadSuite("posts", postTestData, postUpdateData);
