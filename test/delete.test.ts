import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import type { TestCollections } from "./types";

describe("USER tests", () => {
	const testFilename = "test_delete_db";
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

	it("should delete a user", async () => {
		const users = db.collection("users");
		const userData = {
			id: "1",
			name: "Alice Brown",
			email: "alice@example.com",
			age: 28,
		};

		const created = await users.create(userData);
		const deleteResult = await users.delete(created.id);

		expect(deleteResult).toBe(true);
	});

	it("should throw error when deleting non-existent user", async () => {
		const users = db.collection("users");
		await expect(users.delete("non-existent-id")).rejects.toThrowError(
			"Failed to delete document",
		);
	});

	it("should delete a post", async () => {
		const posts = db.collection("posts");
		const postData = {
			id: "1",
			title: "Test Post",
			content: "This is a test post content",
			authorId: "test-author-id",
		};

		const created = await posts.create(postData);
		const deleteResult = await posts.delete(created.id);

		expect(deleteResult).toBe(true);
	});

	it("should throw error when deleting non-existent post", async () => {
		const posts = db.collection("posts");
		await expect(posts.delete("non-existent-id")).rejects.toThrowError(
			"Failed to delete document",
		);
	});
});
