import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmdir } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src/core";
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

		it("should throw error when reading non-existent user", async () => {
			const users = db.collection("users");
			expect(users.read("non-existent-id")).rejects.toThrowError(
				"Document not found",
			);
		});

		it("should throw error when updating non-existent user", async () => {
			const users = db.collection("users");
			expect(
				users.update("non-existent-id", { age: 40 }),
			).rejects.toThrowError("Document not found");
		});

		it("should throw error when deleting non-existent user", async () => {
			const users = db.collection("users");
			expect(
				users.delete("non-existent-id"),
			).rejects.toThrowError("Document not found");
		});

		it("should throw error when creating user with invalid data", async () => {
			const users = db.collection("users");
			expect(
				users.create({ name: 123, email: "invalid", age: "30" } as any),
			).rejects.toThrow();
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

		it("should read a post", async () => {
			const posts = db.collection("posts");
			const postData = {
				title: "Test Post",
				content: "This is a test post content",
				authorId: "test-author-id",
			};

			const created = await posts.create(postData);
			const retrieved = await posts.read(created.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.id).toBe(created.id);
			expect(retrieved?.title).toBe(postData.title);
			expect(retrieved?.content).toBe(postData.content);
			expect(retrieved?.authorId).toBe(postData.authorId);
		});

		it("should update a post", async () => {
			const posts = db.collection("posts");
			const postData = {
				title: "Test Post",
				content: "This is a test post content",
				authorId: "test-author-id",
			};

			const created = await posts.create(postData);
			const updated = await posts.update(created.id, {
				content: "Updated content",
			});

			expect(updated).toBeDefined();
			expect(updated?.id).toBe(created.id);
			expect(updated?.title).toBe(postData.title);
			expect(updated?.content).toBe("Updated content");
			expect(updated?.authorId).toBe(postData.authorId);
		});

		it("should delete a post", async () => {
			const posts = db.collection("posts");
			const postData = {
				title: "Test Post",
				content: "This is a test post content",
				authorId: "test-author-id",
			};

			const created = await posts.create(postData);
			const deleteResult = await posts.delete(created.id);
			const retrieved = await posts.read(created.id);

			expect(deleteResult).toBe(true);
			expect(retrieved).toBeNull();
		});

		it("should throw error when reading non-existent post", async () => {
			const posts = db.collection("posts");
			await expect(posts.read("non-existent-id")).rejects.toThrowError(
				"Document not found",
			);
		});

		it("should throw error when updating non-existent post", async () => {
			const posts = db.collection("posts");
			await expect(
				posts.update("non-existent-id", { content: "Updated" }),
			).rejects.toThrowError("Document not found");
		});

		it("should throw error when deleting non-existent post", async () => {
			const posts = db.collection("posts");
			await expect(
				posts.delete("non-existent-id"),
			).rejects.toThrowError("Document not found");
		});

		it("should query posts by authorId", async () => {
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
			const postData3 = {
				title: "Test Post 3",
				content: "Content 3",
				authorId: "author-2",
			};

			await posts.create(postData1);
			await posts.create(postData2);
			await posts.create(postData3);

			const author1Posts = await posts.query(
				(post) => post.authorId === "author-1",
			);

			expect(author1Posts).toHaveLength(2);
			expect(author1Posts[0].authorId).toBe("author-1");
			expect(author1Posts[1].authorId).toBe("author-1");

			const author2Posts = await posts.query(
				(post) => post.authorId === "author-2",
			);
			expect(author2Posts).toHaveLength(1);
			expect(author2Posts[0].authorId).toBe("author-2");
		});

		it("should throw error when creating post with invalid data", async () => {
			const posts = db.collection("posts");
			await expect(
				posts.create({
					title: 123,
					content: 456,
					authorId: true,
				} as any),
			).rejects.toThrow();
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

			await expect(users.create(invalidUser)).rejects.toThrowError(
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
