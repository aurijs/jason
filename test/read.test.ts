import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rm } from "node:fs/promises";
import path from "node:path";
import JasonDB from "../src/core";
import type { BaseDocument } from "../src/type";

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

const testFilename = "test_read_db";
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

describe('USER tests', () => {
    it("should read a user", async () => {
        const users = db.collection("users");
        const userData = {
            id: "1",
            name: "Jane Doe",
            email: "jane@example.com",
            age: 25,
        };

        const created = await users.create(userData);
        const retrieved = await users.read(created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.name).toBe(userData.name);
        expect(retrieved?.email).toBe(userData.email);
        expect(retrieved?.age).toBe(userData.age);
    });

    it("should throw error when reading non-existent user", async () => {
        const users = db.collection("users");
        await expect(users.read("non-existent-id")).rejects.toThrowError(
            "Document not found",
        );
    });
})

describe("POST tests", () => {
    it("should read a post", async () => {
        const posts = db.collection("posts");
        const postData = {
            id: "1",
            title: "Test Post",
            content: "This is a test post content",
            authorId: "test-author-id",
        };

        const created = await posts.create(postData);
        const retrieved = await posts.read(created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.title).toBe(postData.title);
        expect(retrieved?.content).toBe(postData.content);
        expect(retrieved?.authorId).toBe(postData.authorId);
    });

    it("should throw error when reading non-existent post", async () => {
        const posts = db.collection("posts");
        await expect(posts.read("non-existent-id")).rejects.toThrowError(
            "Document not found",
        );
    });
});