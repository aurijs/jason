import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { createJasonDB } from "../src";

const UserSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
});

describe("makeCollection", () => {
  it("deve criar um documento e depois encontrá-lo pelo id", async () => {
    const db = await createJasonDB({
      path: "./tmp",
      collections: {
        user: UserSchema,
      },
    });

    const new_user = { name: "Jane Doe", age: 30 };
    const created_user = await db.collections.user.create(new_user);
    // const found_user = await db.collections.user.read(created_user.id);

    expect(created_user.name).toEqual(found_user.name);

    expect(created_user.name).toBe("Jane Doe");
    // expect(found_user?.id).toBe(created_user.id);

    // const newPost = { title: "My First Post" };
    // const createdPost = await db.collections.posts.create(newPost);
    // const foundPost = await db.collections.posts.findById(createdPost.id);
  });
});
