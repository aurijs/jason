import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { createJasonDB, createJasonDBLayer, JasonDB } from "../src/core/main.js";

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String
});

describe("JasonDB Entry Point", () => {
  it("should create a database using Effect API (Layer)", async () => {
    const config = {
      base_path: "tmp/db_main_effect",
      collections: {
        users: UserSchema
      }
    };

    const randomPath = `tmp/db_effect_${Math.random().toString(36).substring(7)}`;
    const dynamicConfig = { ...config, base_path: randomPath };
    const DbLayer = createJasonDBLayer(dynamicConfig).pipe(
      Layer.provide(BunContext.layer)
    );

    const Program = Effect.scoped(
        Effect.gen(function*() {
             const db = yield* JasonDB;
             const { users } = db.collections;
          
             yield* users.create({ id: "1", name: "Effect User" });
             
             yield* Effect.sleep("200 millis");
             
             const user = yield* users.findById("1");
          
             expect(user).toEqual({ id: "1", name: "Effect User" });
        }).pipe(Effect.provide(DbLayer))
    );

    await Effect.runPromise(
      Program.pipe(Effect.provide(BunContext.layer))
    );
  });

  it("should create a database using Promise API", async () => {
     const randomPath = `tmp/db_promise_${Math.random().toString(36).substring(7)}`;
     const config = {
      base_path: randomPath,
      collections: {
        users: UserSchema
      }
    };

    const db = await createJasonDB(config);
    
    await db.collections.users.create({ id: "2", name: "Promise User" });
    
    await new Promise(r => setTimeout(r, 1000));

    const user = await db.collections.users.findById("2");
    
    expect(user).toEqual({ id: "2", name: "Promise User" });
    
    if (db[Symbol.asyncDispose]) {
        await db[Symbol.asyncDispose]();
    }
  });
});