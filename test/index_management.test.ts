import { afterEach, describe, expect, it } from "bun:test";
import { unlink } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src";
import type { ITest } from "../src/type";

const testFilename = "test_db";
const filePath = path.join(process.cwd(), `${testFilename}.json`);

afterEach(async () => {
	try {
		await unlink(filePath);
	} catch (error) {
		/* ignore error if file doesn't exist */
	}
});

describe("DB Index Management", () => {
	it("should add an index", async () => {
		const db = new JasonDB<ITest>(testFilename);
		db.addIndex("name");
		expect(db.getIndexes()).toHaveLength(1);
		expect(db.getIndexes()[0].field).toBe("name");
	});

	it("should rebuild indexes", async () => {
		const db = new JasonDB<ITest>(testFilename, [{ id: 1, name: "Test" }]);
		db.addIndex("name");
		await db.rebuildIndexes("name");
		const index = db.getIndex("name");
		expect(index?.values.get("Test")).toEqual([1]);
	});

	it("should update indexes when an item is updated", async () => {
		const db = new JasonDB<ITest>(testFilename, [{ id: 1, name: "Test" }]);
		db.addIndex("name");
		await db.update(1, { name: "Updated" });
		const index = db.getIndex("name");
		expect(index?.values.get("Updated")).toEqual([1]);
	});
});
