import { Effect, Layer, Schema } from "effect";
import path from "path";
import { ConfigService } from "../services/config.js";
import type { JasonDBConfig, SchemaOrString } from "../types/schema.js";
import { parseIndexString, parseSchemaFromString } from "../utils.js";

export const ConfigLive = <const T extends Record<string, SchemaOrString>>(
  config: JasonDBConfig<T>
) =>
  Layer.succeed(
    ConfigService,
    ConfigService.of({
      getBasePath: Effect.succeed(config.base_path),
      getCollectionNames: Effect.succeed(Object.keys(config.collections)),
      getCollectionPath: (collection_name) =>
        Effect.succeed(path.join(config.base_path, collection_name)),
      getIndexPath: (collection_name) =>
        Effect.succeed(
          path.join(config.base_path, collection_name, "_indexes")
        ),
      getCollectionSchema: (collection_name) =>
        Effect.sync(() => {
          const schema_or_string = config.collections[collection_name];

          const schema =
            typeof schema_or_string === "string"
              ? parseSchemaFromString(schema_or_string)
              : (schema_or_string);

          return schema;
        }),
      getIndexDefinitions: (collection_name) =>
        Effect.sync(() => {
          const schema_or_string = config.collections[collection_name];
          const index_string =
            typeof schema_or_string === "string" ? schema_or_string : "";
          return parseIndexString(index_string);
        })
    })
  );
