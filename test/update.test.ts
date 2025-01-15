import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core/main";
import type { BaseDocument } from "../src/types";

interface TestUser extends BaseDocument {
    id: string;
    name: string;
    email: string;
    age: number;
}

interface TestPost extends BaseDocument {
    id: string;
    title: string;
    content: string;
    authorId: string;
}

interface TestCollections {
    users: TestUser[];
    posts: TestPost[];
}

const testFilename = "test_update_db";
const filePath = path.join(process.cwd(), `${testFilename}`);
let db: JasonDB<TestCollections>;

beforeEach(() => {
    db = new JasonDB(testFilename);
});

afterEach(async () => {
    try {
        await rm(filePath, { recursive: true });
    } catch (error) {
        console.error("Error cleaning up test directory:", error);
    }
});

describe("USER tests", () => {
    it("should throw error when updating non-existent user", async () => {
        const users = db.collection("users");
        await expect(
            users.update("non-existent-id", { age: 40 }),
        ).rejects.toThrowError("Failed to acquire lock");
    });
});

describe("POST tests", () => {
    it("should update a post", async () => {
        const posts = db.collection("posts");

        const postData = {
            id: '1',
            title: "Test Post",
            content: "This is a test post content",
            authorId: "test-author-id",
        };

        const created = await posts.create(postData);
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
        await expect(
            posts.update("non-existent-id", { content: "Updated" }),
        ).rejects.toThrowError("Failed to acquire lock");
    });
});