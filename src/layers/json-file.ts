import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import { Json } from "./json.js";
import { isStandardSchema } from "../utils.js";
import type { AnySchema } from "./config.js";

export class JsonFile extends Effect.Service<JsonFile>()("JsonFile", {
  dependencies: [Json.Default, NodeContext.layer],
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const json = yield* Json;

    return {
      /**
       * Reads, parses and decode a JSON file, returning
       * the typed object
       */
      readJsonFile: (path: string, schema: AnySchema) =>
        fs.readFileString(path).pipe(
          Effect.flatMap(json.parse),
          Effect.flatMap((parsedJson) => {
            if (isStandardSchema(schema)) {
              return Effect.tryPromise({
                try: () =>
                  Promise.resolve(schema["~standard"].validate(parsedJson)),
                catch: (e) => new Error(`Validation failed: ${e}`)
              }).pipe(
                Effect.flatMap((result) => {
                  if (result.issues) {
                    return Effect.fail(
                      new Error(
                        `Validation failed: ${result.issues
                          .map((i) => i.message)
                          .join(", ")}`
                      )
                    );
                  }
                  return Effect.succeed(result.value);
                })
              );
            }
            return Schema.decode(schema as Schema.Schema<any, any>)(parsedJson);
          })
        ),

      /**
       * Encode and serialize an object to a JSON string
       * writes it in a file.
       */
      writeJsonFile: (path: string, schema: AnySchema, data: any) => {
        const validate = isStandardSchema(schema)
          ? Effect.tryPromise({
              try: () => Promise.resolve(schema["~standard"].validate(data)),
              catch: (e) => new Error(`Validation failed: ${e}`)
            }).pipe(
              Effect.flatMap((result) => {
                if (result.issues) {
                  return Effect.fail(
                    new Error(
                      `Validation failed: ${result.issues
                        .map((i) => i.message)
                        .join(", ")}`
                    )
                  );
                }
                return Effect.succeed(result.value);
              })
            )
          : Schema.encode(schema as Schema.Schema<any, any>)(data);

        return validate.pipe(
          Effect.flatMap(json.stringify),
          Effect.flatMap((content) => fs.writeFileString(path, content)),
          Effect.asVoid
        );
      }
    };
  })
}) {}
