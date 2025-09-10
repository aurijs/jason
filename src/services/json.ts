import { Context, Effect } from "effect";
import { JsonError } from "../core/errors.js";

export class JsonService extends Context.Tag("JsonService")<
  JsonService,
  {
    /**
     * Parse JSON string to object
     * @param text - JSON string
     * @returns parsed JSON
     */
    readonly parse: (text: string) => Effect.Effect<any, JsonError>;

    /**
     * Stringify object to JSON string
     * @param data - JSON object
     * @returns JSON string
     */
    readonly stringify: (data: unknown) => Effect.Effect<string, JsonError>;
  }
>() {}
