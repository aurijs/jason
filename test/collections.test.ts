import { constants, access, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import type { TestCollections, TestUser } from "./types";

const testFilename = "test_collection_db";
const filePath = path.join(process.cwd(), `${testFilename}`);

describe("Collection tests", () => {
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

	it("should create and list collections", async () => {
		const users = db.collection("users");
		const posts = db.collection("posts");

		expect(users).toBeDefined();
		expect(posts).toBeDefined();

		const collections = await db.listCollections();
		expect(collections).toEqual(expect.arrayContaining(["users", "posts"]));
	});

	it("should handle caching", async () => {
		const users = db.collection("users", {
			cacheTimeout: 1000, // 1 second cache
		});

		const userData = {
			id: "1",
			name: "Cache Test",
			email: "cache@example.com",
			age: 30,
		};

		const created = await users.create(userData);
		const firstRead = await users.read(created.id);
		const secondRead = await users.read(created.id);

		expect(firstRead).toEqual(secondRead);
	});

	it.concurrent("should respect schema validation", async () => {
		const users = db.collection("users", {
			schema: (user: TestUser) => user.age >= 18,
		});

		const validUser = {
			id: "1",
			name: "Adult User",
			email: "adult@example.com",
			age: 25,
		};

		const invalidUser = {
			id: "2",
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

	it.skip("should handle versioning strategy", async () => {
		const users = db.collection("users", {
			concurrencyStrategy: "versioning",
		});

		const userData = {
			id: "1",
			name: "Version Test",
			email: "version@example.com",
			age: 30,
		};

		const created = await users.create(userData);
		expect(created._version).toBe(1);

		const updated = await users.update(created.id, { age: 31 });
		expect(updated?._version).toBe(2);
	});
});
