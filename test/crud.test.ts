import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src";
import type { BaseDocument } from "../src/type";

interface TestUser extends BaseDocument {
	name: string;
	email: string;
	age: number;
}

interface TestPost extends BaseDocument {
	title: string;
	content: string;
	authorId: string;
}

interface TestCollections {
	users: TestUser[];
	posts: TestPost[];
}

const testFilename = "test_db";
const filePath = path.join(process.cwd(), `${testFilename}.json`);

describe("CRUD tests", () => {
	let db: JasonDB<TestCollections>;

	beforeEach(() => {
		db = new JasonDB(testFilename);
	});

	afterEach(async () => {
		try {
			await rmdir(filePath, { recursive: true });
		} catch (error) {
			console.error("Error cleaning up test directory:", error);
		}
	});

	describe("User collection", () => {
		it("should create a new user", async () => {
			const users = db.collection("users");
			const userData = {
				name: "John",
				email: "j@j.com",
				age: 30,
			};

			const user = await users.create(userData);

			expect(user).toBeDefined();
			expect(user.id).toBeDefined();
			expect(user.name).toBe(userData.name);
			expect(user.email).toBe(userData.email);
			expect(user.age).toBe(userData.age);
		});

		it("should read a user", async () => {
			const users = db.collection("users");
			const userData = {
				name: "Jane Doe",
				email: "jane@example.com",
				age: 25,
			};

			const created = await users.create(userData);
			const retrieved = await users.read(created.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.id).toBe(created.id);
			expect(retrieved?.name).toBe(userData.name);
			expect(retrieved?.email).toBe(userData.email);
			expect(retrieved?.age).toBe(userData.age);
		});

		it("should update a user", async () => {
			const users = db.collection("users");
			const userData = {
				name: "Bob Smith",
				email: "bob@example.com",
				age: 35,
			};

			const created = await users.create(userData);
			const updated = await users.update(created.id, { age: 36 });

			expect(updated).toBeDefined();
			expect(updated?.id).toBe(created.id);
			expect(updated?.name).toBe(userData.name);
			expect(updated?.email).toBe(userData.email);
			expect(updated?.age).toBe(36);
		});

		it("should delete a user", async () => {
			const users = db.collection("users");
			const userData = {
				name: "Alice Brown",
				email: "alice@example.com",
				age: 28,
			};

			const created = await users.create(userData);
			const deleteResult = await users.delete(created.id);
			const retrieved = await users.read(created.id);

			expect(deleteResult).toBe(true);
			expect(retrieved).toBeNull();
		});

		it("should handle reading non-existent user", async () => {
			const users = db.collection("users");
			const retrieved = await users.read("non-existent-id");
			expect(retrieved).toBeNull();
		});

		it("should handle updating non-existent user", async () => {
			const users = db.collection("users");
			const updated = await users.update("non-existent-id", { age: 40 });
			expect(updated).toBeNull();
		});
	});

	describe("Post collection", () => {
		it("should create a new post", async () => {
			const posts = db.collection("posts");
			const postData = {
				title: "Test Post",
				content: "This is a test post content",
				authorId: "test-author-id",
			};

			const post = await posts.create(postData);

			expect(post).toBeDefined();
			expect(post.id).toBeDefined();
			expect(post.title).toBe(postData.title);
			expect(post.content).toBe(postData.content);
			expect(post.authorId).toBe(postData.authorId);
		});

		it("should query posts", async () => {
			const posts = db.collection("posts");
			const postData1 = {
				title: "Test Post 1",
				content: "Content 1",
				authorId: "author-1",
			};
			const postData2 = {
				title: "Test Post 2",
				content: "Content 2",
				authorId: "author-1",
			};

			await posts.create(postData1);
			await posts.create(postData2);

			const authorPosts = await posts.query(
				(post) => post.authorId === "author-1",
			);
			expect(authorPosts).toHaveLength(2);
			expect(authorPosts[0].authorId).toBe("author-1");
			expect(authorPosts[1].authorId).toBe("author-1");
		});

		it.todo("should read a post");
		it.todo("should update a post");
		it.todo("should delete a post");
		it.todo("should handle reading non-existent post");
	});

	describe("Collection options", () => {
		it("should respect schema validation", async () => {
			const users = db.collection("users", {
				schema: (user: TestUser) => user.age >= 18,
			});

			const validUser = {
				name: "Adult User",
				email: "adult@example.com",
				age: 25,
			};

			const invalidUser = {
				name: "Minor User",
				email: "minor@example.com",
				age: 15,
			};

			const validCreated = await users.create(validUser);
			expect(validCreated).toBeDefined();
			expect(validCreated.age).toBe(25);

			expect(users.create(invalidUser)).rejects.toThrow(
				"Document failed schema validation",
			);
		});

		it("should handle versioning strategy", async () => {
			const users = db.collection("users", {
				concurrencyStrategy: "versioning",
			});

			const userData = {
				name: "Version Test",
				email: "version@example.com",
				age: 30,
			};

			const created = await users.create(userData);
			expect(created._version).toBe(1);

			const updated = await users.update(created.id, { age: 31 });
			expect(updated?._version).toBe(2);
		});

		it("should handle caching", async () => {
			const users = db.collection("users", {
				cacheTimeout: 1000, // 1 second cache
			});

			const userData = {
				name: "Cache Test",
				email: "cache@example.com",
				age: 30,
			};

			const created = await users.create(userData);
			const firstRead = await users.read(created.id);
			const secondRead = await users.read(created.id);

			expect(firstRead).toEqual(secondRead);
		});
	});
});
