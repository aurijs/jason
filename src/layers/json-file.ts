import { Effect, Layer, Schema } from "effect";
import { JsonFileService } from "../services/json-file.js";
import { FileSystem } from "@effect/platform";
import { JsonService } from "../services/json.js";
import type { Stringified } from "../types/json.js";
import { DatabaseError } from "../core/errors.js";
import { JsonLive } from "./json.js";
import { BunFileSystem } from "@effect/platform-bun";

export const JsonFileLive = Layer.effect(
  JsonFileService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const json = yield* JsonService;

    const readJsonFile = <A, I>(path: string, schema: Schema.Schema<A, I>) =>
      fs.readFileString(path).pipe(
        Effect.map((text) => text as Stringified<A>),
        Effect.flatMap(json.parse),
        Effect.flatMap((parsedJson) => Schema.decode(schema)(parsedJson as I)),
        Effect.mapError(
          (cause) =>
            new DatabaseError({
              message: `Failed to read JSON File: ${path}`,
              cause: cause instanceof Error ? cause : new Error(String(cause))
            })
        )
      );

    const writeJsonFile = <A, I>(
      path: string,
      schema: Schema.Schema<A, I>,
      data: A
    ) =>
      Schema.encode(schema)(data).pipe(
        Effect.flatMap(json.stringify),
        Effect.flatMap((content) => fs.writeFileString(path, content)),
        Effect.asVoid,
        Effect.mapError(
          (cause) =>
            new DatabaseError({
              message: `Failed to write JSON File: ${path}`,
              cause: cause instanceof Error ? cause : new Error(String(cause))
            })
        )
      );

    return {
      readJsonFile,
      writeJsonFile
    };
  }).pipe(Effect.provide(JsonLive), Effect.provide(BunFileSystem.layer))
);
