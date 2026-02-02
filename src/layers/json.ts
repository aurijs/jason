import { Effect } from "effect";
import { JsonError } from "../core/errors.js";

export class Json extends Effect.Service<Json>()("Json", {
  succeed: {
    /**
     * Parse JSON string to object
     * @param text - JSON string
     * @returns parsed JSON
     */
    parse: (text: string) =>
      Effect.try({
        try: () => JSON.parse(text),
        catch: (cause) =>
          new JsonError({ message: "Failed to parse JSON", cause })
      }),
    /**
     * Stringify object to JSON string
     * @param data - JSON object
     * @returns JSON string
     */
    stringify: (data: any) =>
      Effect.try({
        try: () => JSON.stringify(data),
        catch: (cause) =>
          new JsonError({ message: "Failed to stringify JSON", cause })
      })
  }
}) {}
