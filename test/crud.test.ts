import { afterEach, describe, expect, it } from "bun:test";
import { unlink } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src";
import type { ITest } from "../src/type";

const testFilename = "test_db";
const filePath = path.join(process.cwd(), `${testFilename}.json`);

// afterEach(async () => {
// 	try {
// 		await unlink(filePath);
// 	} catch (error) {
// 		/* ignore error if file doesn't exists */
// 	}
// });

describe("DB crud", () => {
	it("should create an item", async () => {
		const db = new JasonDB<ITest>(testFilename);
		const item = { id: 1, name: "Test" };
		const createdItem = await db.create(item);
		expect(createdItem).toEqual(item);
	});

	it("should read an item", async () => {
		const db = new JasonDB<ITest>(testFilename);
		const item = { id: 1, name: "Test" };
		await db.create(item);
		const readItem = await db.read(1);
		expect(readItem).toEqual(item);
	});

	it("should update an item", async () => {
		const db = new JasonDB<ITest>(testFilename);
		const item = { id: 1, name: "Test" };
		await db.create(item);
		const updatedItem = await db.update(1, { name: "Updated" });
		expect(updatedItem).toEqual({ id: 1, name: "Updated" });
	});

	it("should delete an item", async () => {
		const db = new JasonDB(testFilename);
		const item = { id: 1, name: "Test" };
		await db.create(item);
		const deleted = await db.delete(1);
		expect(deleted).toBeTrue();
		const readItem = await db.read(1);
		expect(readItem).toBeNull();
	});
});
