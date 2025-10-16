import { describe, it, expect } from "vitest";
import { Effect, Cause, Option } from "effect";
import { Json } from "../src/layers/json.js";
import { JsonError } from "../src/core/errors.js";

describe("Json Service", () => {
  describe("parse", () => {
    it("should parse a valid JSON string into an object", async () => {
      const validJsonString = '{"name":"jason","age":10}';

      const program = Effect.gen(function* () {
        const json = yield* Json;
        return yield* json.parse(validJsonString);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default))
      );

      expect(result).toEqual({ name: "jason", age: 10 });
    });

    it("should fail with a JsonError for an invalid JSON string", async () => {
      const invalidJsonString = '{"name":"jason",}';

      const program = Effect.gen(function* () {
        const json = yield* Json;
        yield* json.parse(invalidJsonString);
      });

      const cause = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default), Effect.cause)
      );

      const failure = Cause.failureOption(cause);

      expect(Option.isSome(failure)).toBe(true);

      const error = Option.getOrThrow(failure);

      expect(error).toBeInstanceOf(JsonError);
      expect(error.message).toBe("Failed to parse JSON");
    });

    it("should fail with a JsonError for an empty or whitespace string", async () => {
      const program = (input: string) =>
        Effect.gen(function* () {
          const json = yield* Json;
          yield* json.parse(input);
        });

      const causeEmpty = await Effect.runPromise(
        program("").pipe(Effect.provide(Json.Default), Effect.cause)
      );
      const failureEmpty = Cause.failureOption(causeEmpty);
      expect(Option.isSome(failureEmpty)).toBe(true);
      expect(Option.getOrThrow(failureEmpty)).toBeInstanceOf(JsonError);

      const causeWhitespace = await Effect.runPromise(
        program("   ").pipe(Effect.provide(Json.Default), Effect.cause)
      );
      const failureWhitespace = Cause.failureOption(causeWhitespace);
      expect(Option.isSome(failureWhitespace)).toBe(true);
      expect(Option.getOrThrow(failureWhitespace)).toBeInstanceOf(JsonError);
    });

    it("should correctly parse valid JSON primitives", async () => {
      const program = Effect.gen(function* () {
        const json = yield* Json;
        const num = yield* json.parse("123");
        const bool = yield* json.parse("true");
        const str = yield* json.parse('"hello"');
        const nul = yield* json.parse("null");
        return { num, bool, str, nul };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default))
      );

      expect(result.num).toBe(123);
      expect(result.bool).toBe(true);
      expect(result.str).toBe("hello");
      expect(result.nul).toBe(null);
    });
  });

  describe("stringify", () => {
    it("should correctly stringify primitives and arrays", async () => {
      const program = Effect.gen(function* () {
        const json = yield* Json;
        const num = yield* json.stringify(42);
        const bool = yield* json.stringify(false);
        const arr = yield* json.stringify([1, "test", null]);
        return { num, bool, arr };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default))
      );

      expect(result.num).toBe("42");
      expect(result.bool).toBe("false");
      expect(result.arr).toBe('[1,"test",null]');
    });

    it("should handle special JavaScript values according to JSON.stringify rules", async () => {
      const program = Effect.gen(function* () {
        const json = yield* Json;

        const objResult = yield* json.stringify({
          a: 1,
          b: undefined,
          c: Symbol("s")
        });

        const arrResult = yield* json.stringify([1, undefined, Symbol("s")]);

        return { objResult, arrResult };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default))
      );

      expect(result.objResult).toBe('{"a":1}');
      expect(result.arrResult).toBe("[1,null,null]");
    });

    it("should fail with a JsonError when trying to stringify a BigInt", async () => {
      const dataWithBigInt = { value: 123n };

      const program = Effect.gen(function* () {
        const json = yield* Json;
        yield* json.stringify(dataWithBigInt);
      });

      const cause = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default), Effect.cause)
      );
      const failure = Cause.failureOption(cause);

      expect(Option.isSome(failure)).toBe(true);
      const error = Option.getOrThrow(failure);

      expect(error).toBeInstanceOf(JsonError);
      expect(error.message).toBe("Failed to stringify JSON");
    });

    it("should stringify a valid object into a JSON string", async () => {
      const data = { name: "jason", age: 10 };

      const program = Effect.gen(function* () {
        const json = yield* Json;
        return yield* json.stringify(data);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default))
      );

      expect(result).toBe('{"name":"jason","age":10}');
    });

    it("should fail with a JsonError for a circular reference", async () => {
      const circular: any = { name: "jason" };
      circular.self = circular;

      const program = Effect.gen(function* () {
        const json = yield* Json;
        yield* json.stringify(circular);
      });

      const cause = await Effect.runPromise(
        program.pipe(Effect.provide(Json.Default), Effect.cause)
      );
      const failure = Cause.failureOption(cause);

      expect(Option.isSome(failure)).toBe(true);

      const error = Option.getOrThrow(failure);

      expect(error).toBeInstanceOf(JsonError);
      expect(error.message).toBe("Failed to stringify JSON");
    });
  });
});
