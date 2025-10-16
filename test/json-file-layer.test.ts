// test/json-file.test.ts

import { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import { ParseError } from "effect/ParseResult";
import { describe, expect, it } from "vitest";
import { JsonError } from "../src/core/errors.js";
import { JsonFile } from "../src/layers/json-file.js";

const PersonSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
});
type Person = Schema.Schema.Type<typeof PersonSchema>;

const personData: Person = { name: "Jason", age: 42 };

const TestLayer = Layer.mergeAll(JsonFile.Default, BunContext.layer);

describe("JsonFile Service", () => {
  it("writeJsonFile should write an object to a file and readJsonFile should read it back", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const jsonFile = yield* JsonFile;

        const tempDir = yield* fs.makeTempDirectoryScoped();
        const filePath = path.join(tempDir, "test.json");

        yield* jsonFile.writeJsonFile(filePath, PersonSchema, personData);
        const content = yield* fs.readFileString(filePath);

        const readData = yield* jsonFile.readJsonFile(filePath, PersonSchema);

        return { content, readData };
      })
    );

    const { content, readData } = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    const parsed = JSON.parse(content);
    expect(parsed).toEqual(personData);
    expect(readData).toEqual(personData);
  });

  it("readJsonFile should fail if the file does not exist", async () => {
    const program = Effect.gen(function* () {
      const jsonFile = yield* JsonFile;
      yield* jsonFile.readJsonFile("/non/existent/path.json", PersonSchema);
    });

    const cause = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer), Effect.cause)
    );
    const failure = Cause.failureOption(cause);

    expect(Option.isSome(failure)).toBe(true);
    const error = Option.getOrThrow(failure);

    expect(error.cause).toHaveProperty("code", "ENOENT");
  });

  it("readJsonFile should fail with a ParseError if the file content does not match the schema", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const jsonFile = yield* JsonFile;

        const tempDir = yield* fs.makeTempDirectoryScoped();
        const filePath = path.join(tempDir, "invalid.json");

        const invalidData = { name: "Jason", age: "not a number" };
        yield* fs.writeFileString(filePath, JSON.stringify(invalidData));

        const programToTest = jsonFile.readJsonFile(filePath, PersonSchema);
        return yield* Effect.cause(programToTest);
      })
    );

    const cause = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );
    const failure = Cause.failureOption(cause);

    expect(Option.isSome(failure)).toBe(true);
    const error = Option.getOrThrow(failure);
    expect(error).toBeInstanceOf(ParseError);
  });

  it("writeJsonFile should fail with a ParseError if the data does not match the schema", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const jsonFile = yield* JsonFile;

        const tempDir = yield* fs.makeTempDirectoryScoped();
        const filePath = path.join(tempDir, "test.json");

        const invalidData = { name: "Jason", age: "not a number" };

        const programToTest = jsonFile.writeJsonFile(
          filePath,
          PersonSchema,
          // @ts-expect-error expected error
          invalidData
        );
        return yield* Effect.cause(programToTest);
      })
    );

    const cause = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );
    const failure = Cause.failureOption(cause);

    expect(Option.isSome(failure)).toBe(true);
    const error = Option.getOrThrow(failure);
    expect(error).toBeInstanceOf(ParseError);
  });

  it("readJsonFile should fail with a JsonError for malformed JSON", async () => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const jsonFile = yield* JsonFile;

        const tempDir = yield* fs.makeTempDirectoryScoped();
        const filePath = path.join(tempDir, "malformed.json");

        const malformedJson = '{\"name\": \"Jason\", \"age\": 42,}'; // Extra comma
        yield* fs.writeFileString(filePath, malformedJson);

        const programToTest = jsonFile.readJsonFile(filePath, PersonSchema);
        return yield* Effect.cause(programToTest);
      })
    );

    const cause = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );
    const failure = Cause.failureOption(cause);

    expect(Option.isSome(failure)).toBe(true);
    const error = Option.getOrThrow(failure);
    expect(error).toBeInstanceOf(JsonError);
  });

  it("writeJsonFile should fail if the directory does not exist", async () => {
    const program = Effect.gen(function* () {
      const path = yield* Path.Path;
      const jsonFile = yield* JsonFile;

      const filePath = path.join("/non/existent/dir", "test.json");

      return yield* jsonFile.writeJsonFile(filePath, PersonSchema, personData);
    });

    const cause = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer), Effect.cause)
    );
    const failure = Cause.failureOption(cause);

    expect(Option.isSome(failure)).toBe(true);
    const error = Option.getOrThrow(failure);
    expect(error.cause).toHaveProperty("code", "ENOENT");
  });
});
