import { Path } from "@effect/platform";
import { Effect, Schema } from "effect";
import type { JasonDBConfig } from "../types/collection.js";
import {
  buildIndexDefinitions,
  buildSchema,
  parseSchemaString
} from "../utils.js";
import type { IndexDefinition } from "../types/metadata.js";
import type { StandardSchemaV1 } from "../types/schema.js";

export type AnySchema = Schema.Schema<any, any> | StandardSchemaV1<any, any>;

export class ConfigManager extends Effect.Service<ConfigManager>()(
  "ConfigManager",
  {
    effect: (config: JasonDBConfig<any>) =>
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

        return {
          /** @return the database path */
          getBasePath: Effect.succeed(config.base_path),

          /** @return the list of all collection names */
          getCollectionNames: Effect.succeed(Object.keys(config.collections)),

          /**
           * @param collection_name - The name of the collection
           * @return The full path for a specific collection
           */
          getCollectionPath: (collection_name: string) =>
            Effect.succeed(path.join(config.base_path, collection_name)),

          /**
           * @param collection_name - The name of the collection
           * @return The path for the indexes directory of a collecition
           */
          getIndexPath: (collection_name: string) =>
            Effect.succeed(
              path.join(config.base_path, collection_name, "_indexes")
            ),

          /**
           * @param collection_name - The name of the collection
           * @return The schema of a specific collection
           */
          getCollectionSchema: (collection_name: string) =>
            Effect.succeed(all_schemas[collection_name] as AnySchema),

          /**
           * @param collection_name - The name of the collection
           * @return The parsed index definition of a collection
           */
          getIndexDefinitions: (collection_name: string) =>
            Effect.succeed(
              all_index_definitions[collection_name] as Record<
                string,
                IndexDefinition
              >
            ),

          /**
           * @param collection_name - The name of the collection
           * @return The path for the metadata
           */
          getMetadataPath: (collection_name: string) =>
            Effect.succeed(
              path.join(config.base_path, collection_name, "_metadata.json")
            ),

          /**
           * @return The cache configuration
           */
          getCacheConfig: Effect.succeed(config.cache)
        };
      })
  }
) {}
