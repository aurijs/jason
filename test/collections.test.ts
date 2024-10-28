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

describe("Collection tests", () => {
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

	it("should create and list collections", async () => {
		const users = db.collection("users");
		const posts = db.collection("posts");

		expect(users).toBeDefined();
		expect(posts).toBeDefined();

		const collections = await db.listCollections();
		expect(collections).toEqual(["users", "posts"]);
	});
});
