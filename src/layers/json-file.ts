import { FileSystem } from "@effect/platform";
import { BunFileSystem } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { JsonFileService } from "../services/json-file.js";
import { JsonService } from "../services/json.js";
import type { Stringified } from "../types/json.js";
import { JsonLive } from "./json.js";

export const JsonFileLive = Layer.effect(
  JsonFileService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const json = yield* JsonService;

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
      readJsonFile,
      writeJsonFile
    };
  })
  // .pipe(Effect.provide(JsonLive), Effect.provide(BunFileSystem.layer))
);
