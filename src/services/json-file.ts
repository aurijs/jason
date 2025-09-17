import type { PlatformError } from "@effect/platform/Error";
import { Context, type Effect, type Schema } from "effect";
import type { ParseError } from "effect/ParseResult";
import type { JsonError } from "../core/errors.js";

export interface IJsonFileService {
  /**
   * Reads, parses and decode a JSON file, returning
   * the typed object
   *
   * The `A` type is infered from a schema
   */
  readonly readJsonFile: <A, I>(
    path: string,
    schema: Schema.Schema<A, I>
  ) => Effect.Effect<A, ParseError | JsonError | PlatformError>;

  /**
   * Encode and serialize an object to a JSON string
   * writes it in a file.
   */
  readonly writeJsonFile: <A, I>(
    path: string,
    schema: Schema.Schema<A, I>,
    data: A
  ) => Effect.Effect<void, ParseError | JsonError | PlatformError>;
}

export class JsonFileService extends Context.Tag("JsonFileService")<
  JsonFileService,
  IJsonFileService
>() {}
