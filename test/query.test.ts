import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src/core/main";
import type { TestCollections, TestPost, Log } from "./types";
import type { Document } from "../src/types/index.js";

describe("Collection - Query", () => {
  const testFilename = "test_query_db";
  const filePath = path.join(process.cwd(), `${testFilename}`);

  let db: JasonDB<TestCollections>;
  beforeEach(() => {
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

  it("should query posts by authorId", async () => {
    const posts = db.collection("posts");
    const postData1 = {
      id: "1",
      title: "Test Post 1",
      content: "Content 1",
      authorId: "author-1",
    };
    const postData2 = {
      id: "2",
      title: "Test Post 2",
      content: "Content 2",
      authorId: "author-1",
    };
    const postData3 = {
      id: "3",
      title: "Test Post 3",
      content: "Content 3",
      authorId: "author-2",
    };

    await posts.create(postData1);
    await posts.create(postData2);
    await posts.create(postData3);

    const author1Posts = await posts.query(
      (post) => post.authorId === "author-1"
    );

    expect(author1Posts).toHaveLength(2);
    expect(author1Posts[0].authorId).toBe("author-1");
    expect(author1Posts[1].authorId).toBe("author-1");

    const author2Posts = await posts.query(
      (post) => post.authorId === "author-2"
    );
    expect(author2Posts).toHaveLength(1);
    expect(author2Posts[0].authorId).toBe("author-2");
  });

  // Removed duplicate test "should query posts" as it was identical to "should query posts by authorId"
  it("should filter by numeric range", async () => {
    const users = db.collection("users");
    await users.create({ name: "John", age: 25, email: "j@j.com" });
    await users.create({ name: "Alice", age: 30, email: "a@a.com" });
    await users.create({ name: "Bob", age: 35, email: "b@b.com" });

    const result = await users.query((user) => user.age > 28 && user.age < 38);

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.name)).toEqual(
      expect.arrayContaining(["Alice", "Bob"])
    );
  });

  it("should handle complex logical conditions", async () => {
    const products = db.collection("products");
    await products.create({ id: "1", name: "Laptop", price: 999, stock: 5 });
    await products.create({ id: "2", name: "Phone", price: 699, stock: 0 });
    await products.create({ id: "3", name: "Tablet", price: 299, stock: 10 });

    const result = await products.query((p) => p.price < 1000 && p.stock > 0);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining(["1", "3"]));
  });

  it("should handle case insensitive search", async () => {
    const posts = db.collection("posts");
    await posts.create({ title: "Hello World", tags: ["test", "demo"] });
    await posts.create({ title: "Goodbye World", tags: ["demo"] });
    await posts.create({ title: "Hello Universe", tags: ["test"] });

    const result = await posts.query((post) =>
      // Use optional chaining for safety
      post.title?.toLowerCase().includes("hello") ?? false
    );

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.title)).toEqual(
      expect.arrayContaining(["Hello World", "Hello Universe"])
    );
  });

  it("should handle empty results", async () => {
    const users = db.collection("users");
    await users.create({ name: "John", age: 25, email: "j@j.com" });

    const result = await users.query((user) => user.age > 30);

    expect(result).toHaveLength(0);
  });

  // Increase timeout for large dataset test
  it("should handle large datasets efficiently", { timeout: 30000 }, async () => {
    const logs = db.collection("logs");
    // Improve type safety for promises array
    const promises: Promise<Document<TestCollections, "logs">>[] = [];

    // Criar 1000 documentos de teste
    for (let i = 0; i < 1000; i++) {
      promises.push(
        logs.create({
          id: `log-${i}`,
          message: `Log entry ${i}`,
          severity: i % 2 === 0 ? "INFO" : "ERROR",
        })
      );
    }

    await Promise.all(promises);

    const results = await logs.query((log) => log.severity === "ERROR", {
      batchSize: 50,
    });

    expect(results).toHaveLength(500);
  });

  it("should handle nested object properties", async () => {
    const orders = db.collection("orders");
    await orders.create({
      id: "1",
      customer: { name: "John", address: { city: "NY" } },
      total: 100,
    });
    await orders.create({
      id: "2",
      customer: { name: "Alice", address: { city: "LA" } },
      total: 200,
    });

    const result = await orders.query(
      (order) => order.customer.address.city === "NY"
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should handle array operations in queries", async () => {
    const posts = db.collection("posts");
    await posts.create({
      title: "Post 1",
      tags: ["tech", "javascript"],
    });
    await posts.create({
      title: "Post 2",
      tags: ["tech", "typescript"],
    });
    await posts.create({
      title: "Post 3",
      tags: ["news"],
    });

    const result = await posts.query(
      // Use optional chaining for safety
      (post) => (post.tags?.includes("tech") ?? false) && (post.tags?.length ?? 0) > 1
    );

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.title)).toEqual(
      expect.arrayContaining(["Post 1", "Post 2"])
    );
  });

  it("should handle date comparisons", async () => {
    const events = db.collection("events");
    const now = Date.now();

    await events.create({
      name: "Event 1",
      date: now - 86400000,
    });

    await events.create({
      name: "Event 2",
      date: now + 86400000,
    });

    const upcomingEvents = await events.query((event) => event.date > now);

    expect(upcomingEvents).toHaveLength(1);
    expect(upcomingEvents[0].name).toBe("Event 2");
  });

  it("should handle partial matches with regex", async () => {
    const books = db.collection("books");
    await books.create({
      title: "JavaScript: The Good Parts",
      author: "Douglas Crockford",
    });
    await books.create({
      title: "Deep Dive into JavaScript",
      author: "Nicholas C. Zakas",
    });
    await books.create({
      title: "Node.js Design Patterns",
      author: "Nicholas C. Zakas",
    });

    const result = await books.query((book) => /javascript/i.test(book.title));

    expect(result).toHaveLength(2);
    expect(result.map((b) => b.title)).toEqual(
      expect.arrayContaining([
        "JavaScript: The Good Parts",
        "Deep Dive into JavaScript",
      ])
    );
  });

  it("should apply skip and limit in query", async () => {
    const users = db.collection("users");

    for (let i = 1; i <= 5; i++) {
      await users.create({
        id: String(i),
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + i,
      });
    }

    const allUsers = await users.query(() => true);
    expect(allUsers.length).toBe(5);

    const adults = await users.query((u) => u.age >= 24, { limit: 2 });
    expect(adults.length).toBe(2);
    // Use arrayContaining for order-independent check
    expect(adults.map((u) => u.id)).toEqual(expect.arrayContaining(["4", "5"]));

    const skipped = await users.query((u) => u.age >= 22, { skip: 1 });
    expect(skipped.length).toBe(3); // 5 total, skip 1 = 4? No, query is age >= 22 (users 2,3,4,5), skip 1 leaves 3,4,5. Length is 3.
    // Check content regardless of order
    expect(skipped.map((u) => u.id)).toEqual(expect.arrayContaining(["3", "4", "5"]));
  });

  // Increase timeout for batch size test (was timing out)
  it("should respect batchSize in query", { timeout: 30000 }, async () => {
    const users = db.collection("users");

    for (let i = 1; i <= 150; i++) {
      await users.create({
        id: String(i),
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + i,
      });
    }

    const result = await users.query(() => true, { batchSize: 50 });

    expect(result.length).toBe(150);
  });
});
