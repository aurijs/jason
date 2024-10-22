import { describe, it, expect } from "bun:test";
import JasonDB from "../src";

const testFileName = "test_db";

describe("DB create", () => {
	it("handles string ids", async () => {
		const db = new JasonDB<{ id: string; value: string }>(testFileName);
		const item = { id: "abc", value: "Test" };
		await db.create(item);
		const readItem = await db.read("abc");
		expect(readItem).toEqual(item);
	});
});
