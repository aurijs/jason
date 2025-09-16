import { Layer, Effect } from "effect";
import { JsonService } from "../services/json.js";
import { JsonError } from "../core/errors.js";

interface JSON {
  
}

export const JsonLive = Layer.succeed(
  JsonService,
  JsonService.of({
    parse: (text: string) =>
      Effect.try({
        try: () => JSON.parse(text),
        catch: (cause) =>
          new JsonError({ message: "Failed to parse JSON", cause })
      }),
    stringify: (data: unknown) =>
      Effect.try({
        try: () => JSON.stringify(data),
        catch: (cause) =>
          new JsonError({ message: "Failed to stringify JSON", cause })
      })
  })
);
