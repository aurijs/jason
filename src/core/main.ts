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
import { JsonLive } from "../layers/json.js";

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

const InfraLayer = Layer.merge(NodeFileSystem.layer, JsonLive);

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
  ).pipe(Layer.provide(InfraLayer));

/**
 * Creates a Promise client from an Effect service.
 *
 * @param effect_service A Record of functions that return Effects.
 * @param run A function that takes an Effect and returns a Promise of the Effect's result.
 * @returns A Record where each key is a function that returns a Promise of the Effect's result.
 */
function createPromiseClient(
  effect_service: CollectionEffect<any>,
  run: (effect: Effect.Effect<any, any, any>) => Promise<any>
): Collection<any> {
  const promice_clent: any = {};

  (Object.keys(effect_service) as Array<keyof CollectionEffect<any>>).forEach(
    (key) => {
      const prop = effect_service[key];

      if (typeof prop === "function") {
        const effectFn = prop as (
          ...args: any[]
        ) => Effect.Effect<any, any, any>;
        promise_client[key] = (...args: any[]) => run(effectFn(...args));
      }
    }
  );

  return promice_clent;
}

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

    promise_based_collection[name] = createPromiseClient(
      effect_based_collection,
      run
    );
  }

  const promise_based_db = {
    collections: promise_based_collection
  };

  return promise_based_db as Database<InferCollections<T>>;
};
