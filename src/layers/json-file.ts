import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import type { Stringified } from "../types/json.js";
import { Json } from "./json.js";

export class JsonFile extends Effect.Service<JsonFile>()("JsonFile", {
  dependencies: [Json.Default, BunContext.layer],
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const json = yield* Json;

    const readJsonFile = <A, I>(path: string, schema: Schema.Schema<A, I>) =>
      fs.readFileString(path).pipe(
        Effect.map((text) => text as Stringified<A>),
        Effect.flatMap(json.parse),
        Effect.flatMap((parsedJson) => Schema.decode(schema)(parsedJson as I))
      );

    const writeJsonFile = <A, I>(
      path: string,
      schema: Schema.Schema<A, I>,
      data: A
    ) =>
      Schema.encode(schema)(data).pipe(
        Effect.flatMap(json.stringify),
        Effect.flatMap((content) => fs.writeFileString(path, content)),
        Effect.asVoid
      );

    return {
      /**
       * Reads, parses and decode a JSON file, returning
       * the typed object
       *
       * The `A` type is infered from a schema
       */
      readJsonFile,

      /**
       * Encode and serialize an object to a JSON string
       * writes it in a file.
       */
      writeJsonFile
    };
  })
}) {}
