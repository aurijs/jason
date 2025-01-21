import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src/core/main";
import type { TestCollections } from "./types";

describe.concurrent("POST tests", () => {
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
			(post) => post.authorId === "author-1",
			{ concurrent: true },
		);

		expect(author1Posts).toHaveLength(2);
		expect(author1Posts[0].authorId).toBe("author-1");
		expect(author1Posts[1].authorId).toBe("author-1");

		const author2Posts = await posts.query(
			(post) => post.authorId === "author-2",
			{ concurrent: true },
		);
		expect(author2Posts).toHaveLength(1);
		expect(author2Posts[0].authorId).toBe("author-2");
	});

	it("should query posts", async () => {
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

		await posts.create(postData1);
		await posts.create(postData2);

		const authorPosts = await posts.query(
			(post) => post.authorId === "author-1",
			{ concurrent: true },
		);

		expect(authorPosts).toHaveLength(2);
		expect(authorPosts[0].authorId).toBe("author-1");
		expect(authorPosts[1].authorId).toBe("author-1");
	});
});
