import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Context, Effect, Layer, Runtime, Schema } from "effect";
import { makeCollection } from "../services/collection.js";
import type { Database, DatabaseEffect } from "../types/database.js";
import type { JasonDBConfig, SchemaOrString } from "../types/schema.js";
import type {
  Collection,
  CollectionEffect,
  InferCollections
} from "../types/collection.js";

class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  DatabaseEffect<any>
>() {}

function parseSchemaFromString(schema_string: string) {
  const fields = schema_string.split(",").reduce(
    (acc, field) => {
      const field_name = field.replace(/^\+\+|[&*]/, "");
      acc[field_name] = Schema.Any;
      return acc;
    },
    {} as Record<string, Schema.Schema<any, any>>
  );
  return Schema.Struct(fields);
}

export const createJasonDBLayer = <
  const T extends Record<string, SchemaOrString>
>(
  config: JasonDBConfig<T>
) =>
  Layer.scoped(
    DatabaseService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const base_path = config.path;
      yield* fs.makeDirectory(base_path, { recursive: true });

      const collection_services: Record<string, CollectionEffect<any>> = {};

      for (const name in config.collections) {
        const schema_or_string = config.collections[name];
        const schema =
          typeof schema_or_string === "string"
            ? parseSchemaFromString(schema_or_string)
            : (schema_or_string as Schema.Schema<any, any>);

        const collection_path = `${base_path}/${name}`;
        yield* fs.makeDirectory(collection_path, { recursive: true });

        collection_services[name] = yield* makeCollection(
          collection_path,
          schema
        );
      }

      type CollectionsSchema = {
        [K in keyof T]: T[K] extends Schema.Schema<any, infer A> ? A : any;
      };

      const databaseService: DatabaseEffect<CollectionsSchema> = {
        collections: collection_services as any
      };

      return databaseService;
    })
  ).pipe(Layer.provide(NodeFileSystem.layer));

export const createJasonDB = async <
  const T extends Record<string, SchemaOrString>
>(
  config: JasonDBConfig<T>
): Promise<Database<InferCollections<T>>> => {
  const layer = createJasonDBLayer(config);
  const runtime = await Effect.runPromise(
    Layer.toRuntime(layer).pipe(Effect.scoped)
  );
  const run = Runtime.runPromise(runtime);
  const effect_base_db = await run(DatabaseService);
  const promise_based_collection: Record<string, Collection<any>> = {};

  for (const name in effect_base_db.collections) {
    const effect_based_collection = effect_base_db.collections[name];

    promise_based_collection[name] = {
      create: (data: any) => run(effect_based_collection.create(data)),
      findById: (id: string) => run(effect_based_collection.findById(id)),
      delete: (id: string) => run(effect_based_collection.delete(id)),
      find: (options: any) => run(effect_based_collection.find(options)),
      update: (id: string, data: any) =>
        run(effect_based_collection.update(id, data))
    };
  }

  const promise_based_db = {
    collections: promise_based_collection
  };

  return promise_based_db as Database<InferCollections<T>>;
};
