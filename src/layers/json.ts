import { Layer, Effect } from "effect";
import { JsonService } from "../services/json.js";
import { JsonError } from "../core/errors.js";
import type { JsonifiedObject, Stringified } from "../types/json.js";

export const JsonLive = Layer.succeed(
  JsonService,
  JsonService.of({
    parse: <T>(text: Stringified<T>) =>
      Effect.try({
        try: () => JSON.parse(text) as JsonifiedObject<T>,
        catch: (cause) =>
          new JsonError({ message: "Failed to parse JSON", cause })
      }),
    stringify: <T>(data: T) =>
      Effect.try({
        try: () => JSON.stringify(data) as Stringified<T>,
        catch: (cause) =>
          new JsonError({ message: "Failed to stringify JSON", cause })
      })
  })
);
