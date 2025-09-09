import { Schema } from "effect";

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number,
});

describe("makeCollection", () => {
  it("should create a collection", () => {
    const collection = makeCollection("users", UserSchema);
    expect(collection).toBeDefined();
  });
});
