import { Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { ConfigService } from "../services/config.js";
import type { JasonDBConfig } from "../types/collection.js";
import type { SchemaOrString } from "../types/schema.js";
import {
  buildIndexDefinitions,
  buildSchema,
  parseSchemaString
} from "../utils.js";

export const ConfigLive = <const T extends Record<string, SchemaOrString>>(
  config: JasonDBConfig<T>
) =>
  Layer.effect(
    ConfigService,
    Effect.gen(function* () {
      const path = yield* Path.Path;

      const all_parsed_fields = Object.fromEntries(
        Object.entries(config.collections).map(([name, schema]) => [
          name,
          typeof schema === "string" ? parseSchemaString(schema) : []
        ])
      );

      const all_index_definitions = Object.fromEntries(
        Object.entries(all_parsed_fields).map(([name, parsed]) => [
          name,
          buildIndexDefinitions(parsed)
        ])
      );

      const all_schemas = Object.fromEntries(
        Object.entries(config.collections).map(([name, schemaOrString]) => {
          if (typeof schemaOrString === "string") {
            return [name, buildSchema(all_parsed_fields[name])];
          }
          return [name, schemaOrString];
        })
      );

      return ConfigService.of({
        getBasePath: Effect.succeed(config.base_path),
        getCollectionNames: Effect.succeed(Object.keys(config.collections)),
        getCollectionPath: (collection_name) =>
          Effect.succeed(path.join(config.base_path, collection_name)),
        getIndexPath: (collection_name) =>
          Effect.succeed(
            path.join(config.base_path, collection_name, "_indexes")
          ),
        getCollectionSchema: (collection_name) =>
          Effect.succeed(all_schemas[collection_name]),
        getIndexDefinitions: (collection_name) =>
          Effect.succeed(all_index_definitions[collection_name]),
        getMetadataPath: (collection_name) =>
          Effect.succeed(
            path.join(config.base_path, collection_name, "_metadata.json")
          )
      });
    })
    // .pipe(Effect.provide(BunContext.layer))
  );
