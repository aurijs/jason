import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import type { TestCollections } from "./types";

let testFilename: string;
let filePath: string;
let db: JasonDB<TestCollections>;

beforeEach(() => {
	testFilename = "test_update_db";
	filePath = path.join(process.cwd(), testFilename);
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

describe("USER tests", () => {
	it("should throw error when updating non-existent user", async () => {
		const users = db.collection("users");
		expect(
			await users.update("non-existent-id", { age: 40 }),
		).toBeNull();
	});
});

describe("POST tests", () => {
	it("should update a post", async () => {
		const posts = db.collection("posts");

		const postData = {
			id: "1",
			title: "Test Post",
			content: "This is a test post content",
			authorId: "test-author-id",
		};

		const created = await posts.create(postData);
		expect(created.id).toEqual(postData.id);

		const updated = await posts.update(created.id, {
			content: "Updated content",
		});

		expect(updated).toBeDefined();
		expect(updated?.id).toBe(created.id);
		expect(updated?.title).toBe(postData.title);
		expect(updated?.content).toBe("Updated content");
		expect(updated?.authorId).toBe(postData.authorId);
	});

	it("should throw error when updating non-existent post", async () => {
		const posts = db.collection("posts");
		expect(
			await posts.update("non-existent-id", { content: "Updated" }),
		).toBeNull();
	});
});
