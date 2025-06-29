import { parse, stringify } from "devalue";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import type { TestCollections, TestPost } from "./types";
import type { Document } from "../src/types/index.js";

const testFilename = "test_create_db";
const filePath = path.join(process.cwd(), `${testFilename}`);

let db: JasonDB<TestCollections>;

beforeEach(async () => {
  db = new JasonDB(testFilename);
});

afterEach(async () => {
  try {
    await rm(filePath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error cleaning up test directory:", error);
      throw error;
    }
  }
});

describe("Collection - CREATE", () => {
  it("should generate ID if not provided", async () => {
    const users = db.collection("users");
    const user = await users.create({
      name: "John",
      email: "j@j.com",
      age: 30,
    });

    expect(user.id).toBeDefined();
    expect(user.id).toMatch(/^[\da-f-]{36}$/);
  });

  it("should create document with custom ID", async () => {
    const users = db.collection("users");
    const user = await users.create({
      id: "custom-id",
      name: "John",
      email: "j@j.com",
      age: 30,
    });

    expect(user.id).toBe("custom-id");
  });

  it("should persist document to filesystem", async () => {
    const posts = db.collection("posts");
    const post = await posts.create({
      title: "Post",
      content: "Content",
      authorId: "author",
    });

    // Use encoded ID for direct file path check
    const encodedId = Buffer.from(post.id).toString("base64url");
    const docPath = path.join(filePath, "posts", `${encodedId}.json`);
    await expect(access(docPath)).resolves.toBeUndefined();

    const rawData = await readFile(docPath, "utf-8");
    const data = parse(rawData);
    expect(data).toEqual(post);
  });

  it("should update cache after creation", async () => {
    const posts = db.collection("posts", { cacheTimeout: 1000 });
    const post = await posts.create({
      title: "Cached Post",
      content: "Content",
      authorId: "author",
    });

    // Use encoded ID for direct file path check
    const encodedId = Buffer.from(post.id).toString("base64url");
    const docPath = path.join(filePath, "posts", `${encodedId}.json`);
    await writeFile(docPath, stringify({ ...post, title: "Modified" }));

    const cachedPost = await posts.read(post.id);
    expect(cachedPost?.title).toBe("Cached Post");
  });

  it("should increment metadata documentCount (if enabled)", async () => {
    const users = db.collection("users", { generateMetadata: true });

    await users.create({ name: "John", email: "j@j.com", age: 30 });
    await users.create({ name: "Jane", email: "j@j.com", age: 25 });

    const metadataPath = path.join(filePath, "users", "_metadata.json");
    const metadata = parse(await readFile(metadataPath, "utf-8"));
    expect(metadata.documentCount).toBe(2);
  });

  it("should throw schema validation error", async () => {
    const users = db.collection("users", {
      schema: (doc) => doc.age > 18,
    });

    await expect(
      users.create({ name: "Teen", email: "t@t.com", age: 16 })
    ).rejects.toThrow("Document failed schema validation");
  });

  // Increase timeout and improve type safety
  it("should handle 1000 concurrent writes", { timeout: 30000 }, async () => {
    const posts = db.collection("posts");
    const count = 1000;
    // Define the input data type explicitly
    type PostInput = Omit<TestPost, "id">;
    // Type the promises array
    const promises: Promise<Document<TestCollections, "posts">>[] = Array.from(
      { length: count },
      (_, i) =>
        posts.create({
          // Ensure data conforms to PostInput
          title: `Post ${i}`,
          content: "Content",
          authorId: "author",
        } as PostInput), // Cast needed if create expects exact input type
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(count);
    expect(new Set(results.map((d) => d.id))).toHaveLength(count);
  });
});
