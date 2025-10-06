import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import {
  Context,
  Effect,
  Exit,
  Layer,
  Runtime,
  Schema,
  Scope,
  Stream
} from "effect";
import { ConfigManager } from "../layers/config.js";
import { JsonFile } from "../layers/json-file.js";
import { Json } from "../layers/json.js";
import { WriteAheadLog } from "../layers/wal.js";
import { makeCollection } from "../make/collection.js";
import type {
  Collection,
  CollectionEffect,
  InferCollections,
  JasonDBConfig
} from "../types/collection.js";
import type { Database, DatabaseEffect } from "../types/database.js";
import type { SchemaOrString } from "../types/schema.js";

export class JasonDB extends Context.Tag("DatabaseService")<
  JasonDB,
  DatabaseEffect<any>
>() {}

const makeJasonDB = <const T extends Record<string, SchemaOrString>>(
  config: JasonDBConfig<T>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonFile = yield* JsonFile;
    const wal = yield* WriteAheadLog;
    const configManager = yield* ConfigManager;

    let lastSegment = 0;
    yield* wal.replay.pipe(
      Stream.runForEach(({ op, segment }) => {
        lastSegment = Math.max(lastSegment, segment);
        return Effect.gen(function* () {
          const schema = yield* configManager.getCollectionSchema(
            op.collection
          );
          const collectionPath = yield* configManager.getCollectionPath(
            op.collection
          );

          switch (op._tag) {
            case "CreateOp": {
              const docPath = `${collectionPath}/${op.data.id}.json`;
              return yield* jsonFile.writeJsonFile(docPath, schema, op.data);
            }
            case "UpdateOp": {
              const docPath = `${collectionPath}/${op.id}.json`;
              return yield* jsonFile.readJsonFile(docPath, schema).pipe(
                Effect.flatMap((doc) =>
                  doc
                    ? jsonFile.writeJsonFile(docPath, schema, {
                        ...doc,
                        ...op.data
                      })
                    : Effect.void
                ),
                Effect.catchTag("SystemError", () => Effect.void)
              );
            }
            case "DeleteOp": {
              const docPath = `${collectionPath}/${op.id}.json`;
              return yield* fs
                .remove(docPath, { recursive: true })
                .pipe(Effect.catchTag("SystemError", () => Effect.void));
            }
          }
        });
      })
    );

    if (lastSegment > 0) {
      yield* wal.checkpoint(lastSegment);
    }

    const collection_names = config.collections
      ? Object.keys(config.collections)
      : [];
    const base_path = config.base_path;

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
  });

export const createJasonDBLayer = <
  const T extends Record<string, SchemaOrString>
>(
  config: JasonDBConfig<T>
): Layer.Layer<JasonDB, Error, never> => {
  const ConfigLayer = ConfigManager.Default(config);

  const BaseInfraLayer = Layer.mergeAll(
    JsonFile.Default,
    BunContext.layer,
    Json.Default,
    WriteAheadLog.Default
  );

  const AppLayer = Layer.scoped(JasonDB, makeJasonDB<T>(config));

  const FullInfraLayer = Layer.provideMerge(BaseInfraLayer, ConfigLayer);

  return AppLayer.pipe(Layer.provide(FullInfraLayer));
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
  const scope = await Effect.runPromise(Scope.make());
  const context = await Effect.runPromise(
    Layer.build(layer).pipe(Scope.extend(scope))
  );

  const runtime = Runtime.make({ ...Runtime.defaultRuntime, context });
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

  // const dispode = () => Effect.runPromise(Scope.close(scope, Exit.void));

  return promise_based_db as Database<InferCollections<T>>;
};
