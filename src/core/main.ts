import { FileSystem } from "@effect/platform";
import { BunFileSystem } from "@effect/platform-bun";
import { Context, Effect, Layer, Runtime, Schema } from "effect";
import { ConfigLive } from "../layers/config.js";
import { JsonFileLive } from "../layers/json-file.js";
import { JsonLive } from "../layers/json.js";
import { WALLive } from "../layers/wal.js";
import { makeCollection } from "../services/collection.js";
import { ConfigService } from "../services/config.js";
import type {
  Collection,
  CollectionEffect,
  InferCollections,
  JasonDBConfig
} from "../types/collection.js";
import type { Database, DatabaseEffect } from "../types/database.js";
import type { SchemaOrString } from "../types/schema.js";
import { StateLive } from "../layers/state.js";

export class JasonDB extends Context.Tag("DatabaseService")<
  JasonDB,
  DatabaseEffect<any>
>() {}

export const createJasonDBLayer = <
  const T extends Record<string, SchemaOrString>
>(
  config: JasonDBConfig<T>
) => {
  const BaseInfraLayer = Layer.mergeAll(
    BunFileSystem.layer,
    JsonLive,
    JsonFileLive
  );

  const AppServicesLayer = Layer.mergeAll(
    ConfigLive(config),
    WALLive,
    StateLive
  );

  const InfraLayer = Layer.mergeAll(AppServicesLayer, BaseInfraLayer);

  return Layer.scoped(
    JasonDB,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const base_path = config.base_path;
      const configService = yield* ConfigService;
      const collection_names = yield* configService.getCollectionNames;

      yield* fs.makeDirectory(base_path, { recursive: true });

      const collection_services = yield* Effect.all(
        Object.fromEntries(
          collection_names.map((name) => [name, makeCollection(name)])
        )
      );

      type CollectionsSchema = {
        [K in keyof T]: T[K] extends Schema.Schema<any, infer A> ? A : any;
      };

      const databaseService: DatabaseEffect<CollectionsSchema> = {
        collections: collection_services as any
      };

      return databaseService;
    })
  ).pipe(Layer.provide(InfraLayer));
};
/**
 * Creates a Promise client from an Effect service.
 *
 * @param effect_service A Record of functions that return Effects.
 * @param run A function that takes an Effect and returns a Promise of the Effect's result.
 * @returns A Record where each key is a function that returns a Promise of the Effect's result.
 */
function createPromiseClient<Doc>(
  effect_service: CollectionEffect<Doc>,
  run: (effect: Effect.Effect<any, any, any>) => Promise<any>
): Collection<Doc> {
  const promise_client: any = {};

  (Object.keys(effect_service) as Array<keyof CollectionEffect<Doc>>).forEach(
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

  return promise_client;
}

/**
 * Creates a JasonDB instance based on the provided configuration.
 *
 * @param config - The configuration object for the JasonDB instance.
 * @returns A Promise that resolves to a Database instance with collections defined in the config.
 */
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

  const effect_base_db = (await run(JasonDB)) as DatabaseEffect<
    InferCollections<T>
  >;

  const promise_based_collection: {
    [K in keyof InferCollections<T>]: Collection<InferCollections<T>[K]>;
  } = {} as any;

  for (const name in effect_base_db.collections) {
    const effect_based_collection = effect_base_db.collections[name];

    promise_based_collection[name as keyof typeof promise_based_collection] =
      createPromiseClient(effect_based_collection, run);
  }

  const promise_based_db = {
    collections: promise_based_collection
  };

  return promise_based_db as Database<InferCollections<T>>;
};
