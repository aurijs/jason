import { Context, Effect } from "effect";
import { JsonError } from "../core/errors.js";
import type { JsonifiedObject, Stringified } from "../types/json.js";

export class JsonService extends Context.Tag("JsonService")<
  JsonService,
  {
    /**
     * Parse JSON string to object
     * @param text - JSON string
     * @returns parsed JSON
     */
    readonly parse: <T>(
      text: Stringified<T>
    ) => Effect.Effect<JsonifiedObject<T>, JsonError>;

    /**
     * Stringify object to JSON string
     * @param data - JSON object
     * @returns JSON string
     */
    readonly stringify: <T>(
      data: T
    ) => Effect.Effect<Stringified<T>, JsonError>;
  }
>() {}
