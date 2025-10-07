import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import {
  Chunk,
  Context,
  Effect,
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
import { makeStorageManager } from "../make/storage-manager.js";
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
    const wal = yield* WriteAheadLog;

    const storage_managers = new Map<
      string,
      Effect.Effect.Success<ReturnType<typeof makeStorageManager>>
    >();

    const getStorageManager = (collectionName: string) =>
      Effect.gen(function* () {
        if (storage_managers.has(collectionName)) {
          return storage_managers.get(collectionName)!;
        }
        const storageManager = yield* makeStorageManager<any>(collectionName);
        storage_managers.set(collectionName, storageManager);
        return storageManager;
      });

    let last_segment = 0;

    const all_ops = yield* wal.replay.pipe(Stream.runCollect);

    if (all_ops.length > 0) {
      last_segment = Chunk.reduce(all_ops, 0, (max, { segment }) =>
        Math.max(max, segment)
      );

      const grouped_by_document = Object.groupBy(all_ops, ({ op }) => {
        const id = op._tag === "CreateOp" ? op.data.id : op.id;
        return `${op.collection}/${id}}`;
      });

      yield* Effect.all(
        Object.values(grouped_by_document).map((ops) =>
          Effect.forEach(
            ops!,
            ({ op }) =>
              Effect.gen(function* () {
                const storage = yield* getStorageManager(op.collection);
                switch (op._tag) {
                  case "CreateOp": {
                    return yield* storage.write(op.data.id as string, op.data);
                  }
                  case "UpdateOp": {
                    return yield* storage.read(op.id).pipe(
                      Effect.flatMap((doc) =>
                        doc
                          ? storage.write(op.id, { ...doc, ...op.data })
                          : Effect.void
                      ),
                      Effect.catchTag("SystemError", () => Effect.void)
                    );
                  }
                  case "DeleteOp": {
                    return yield* storage
                      .remove(op.id)
                      .pipe(Effect.catchTag("SystemError", () => Effect.void));
                  }
                }
              }),
            { discard: true }
          )
        ),
        { concurrency: 1, discard: true }
      );
    }

    if (last_segment > 0) {
      yield* wal.checkpoint(last_segment);
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

    const database_service: DatabaseEffect<CollectionsSchema> = {
      collections: collection_services as any
    };

    return database_service;
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
