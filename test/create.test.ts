import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JasonDB from "../src/core";
import type { TestCollections, TestPost } from "./types";

const testFilename = "test_create_db";
const filePath = path.join(process.cwd(), `${testFilename}`);

let db: JasonDB<TestCollections>;

beforeEach(async () => {
    db = new JasonDB(testFilename);
})

afterEach(async () => {
    try {
        await rm(filePath, { recursive: true });
    } catch (error) {
        console.error("Error cleaning up test directory:", error);
    }
});
describe('CREATE USER tests', () => {

    it('should create a user', async () => {
        const users = db.collection("users");
        const userData = {
            id: "1",
            name: "John",
            email: "j@j.com",
            age: 30,
        };

        const user = await users.create(userData);

        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.name).toBe(userData.name);
        expect(user.email).toBe(userData.email);
        expect(user.age).toBe(userData.age);
    });

    it("should throw error when creating user with invalid data", async () => {
        const users = db.collection("users", {
            schema: (user) => typeof user.name === "string" && typeof user.email === "string" && typeof user.age === "number",
        });
        await expect(
            users.create({ name: 123, email: "invalid", age: "30" } as any),
        ).rejects.toThrow('Document failed schema validation');
    });
});

describe('CREATE POST collection', () => {
    it("should create a new post", async () => {
        const posts = db.collection("posts");
        const postData = {
            id: "1",
            title: "Test Post",
            content: "This is a test post content",
            authorId: "test-author-id",
        };

        const post = await posts.create(postData);

        expect(post).toBeDefined();
        expect(post.id).toBeDefined();
        expect(post.title).toBe(postData.title);
        expect(post.content).toBe(postData.content);
        expect(post.authorId).toBe(postData.authorId);
    });

    it("should throw error when creating post with invalid data", async () => {
        const posts = db.collection("posts", {
            schema: (post: TestPost) => typeof post.title === "string" && typeof post.content === "string" && typeof post.authorId === "string",
        });
        expect(
            posts.create({
                title: 123,
                content: 456,
                authorId: true,
            } as any),
        ).rejects.toThrow();
    });
})