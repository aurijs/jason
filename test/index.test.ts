// test/index.test.ts
import { describe, expect, it } from "bun:test";
import JasonDB from "../src";

describe("JasonDB", () => {
	it("should create a new instance with a file path", () => {
		const db = new JasonDB("test_db");
		expect(db.filePath).toBe("test_db.json");
	});

	it("should initialize data if provided", async () => {
		const db = new JasonDB("test_db", [{ id: 1, name: "Test" }]);
		const data = await db.readFile();
		expect(data).toEqual([{ id: 1, name: "Test" }]);
	});

	it("should update indexes when an item is updated", async () => {
		const db = new JasonDB("test_db", [{ id: 1, name: "Test" }]);
		await db.update(1, { name: "Updated" });
		const indexes = db.indexes;
		expect(indexes).toHaveLength(1);
		expect(indexes[0].values.get("Updated")).toEqual([1]);
	});

	it("should delete an item and update indexes", async () => {
		const db = new JasonDB("test_db", [{ id: 1, name: "Test" }]);
		await db.delete(1);
		const indexes = db.indexes;
		expect(indexes).toHaveLength(0);
	});
});
