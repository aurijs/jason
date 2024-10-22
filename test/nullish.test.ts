import { afterEach, describe, expect, it } from "bun:test";
import JasonDB from "../src";
import path from 'node:path';
import {unlink} from 'node:fs/promises';
import type { ITest } from "../src/type";

const testFilename = "test_db";
const filePath = path.join(process.cwd(), `${testFilename}.json`);

afterEach(async () => {
	try {
		await unlink(filePath);
	} catch (error) {
		/* ignore error if file doesn't exists */
	}
});

describe("DB non existent", () => {
	it("should return null if file doens't exists", async () => {
		const db = new JasonDB<ITest>(testFilename);
		const nonExistentItem = await db.read(1);

		expect(nonExistentItem).toBeNull();
	});

	it("should return false if cant't delete", async () => {
		const db = new JasonDB<ITest>(testFilename);
		const nonExistentItem = await db.delete(1);

        expect(nonExistentItem).toBeFalse();
	});
});
