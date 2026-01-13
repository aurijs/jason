import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import {
  Context,
  Effect,
  Exit,
  GroupBy,
  Layer,
  Ref,
  Runtime,
  type Schema,
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

    const last_segment = yield* Ref.make(0);

    const replay_effect = wal.replay.pipe(
      Stream.tap(({ segment }) => Ref.set(last_segment, Math.max(segment, 0))),
      Stream.groupByKey(
        ({ op }) =>
          `${op.collection}/${op._tag === "CreateOp" ? op.data.id : op.id}`,
        { bufferSize: 8192 }
      ),
      (grouped_stream) =>
        GroupBy.evaluate(grouped_stream, (_key, stream) =>
          Stream.fromEffect(
            Stream.runForEach(stream, ({ op }) =>
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
              })
            )
          )
        ),
      Stream.runDrain
    );

    yield* replay_effect;

    const final_last_segment = yield* Ref.get(last_segment);
    if (final_last_segment > 0) {
      yield* wal.checkpoint(final_last_segment);
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
): Layer.Layer<JasonDB, Error, FileSystem.FileSystem | Path.Path> => {
  const ConfigLayer = ConfigManager.Default(config);

  const BaseInfraLayer = Layer.mergeAll(
    JsonFile.Default,
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
function createPromiseClient<T extends CollectionEffect<any>>(
  effect_service: CollectionEffect<T>,
  run: (effect: Effect.Effect<any, any, any>) => Promise<any>
) {
  const promise_client = {} as Collection<any>;

  (Object.keys(effect_service) as Array<keyof CollectionEffect<T>>).forEach(
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
  const layer = createJasonDBLayer(config).pipe(
    Layer.provide(NodeContext.layer)
  );
  const scope = await Effect.runPromise(Scope.make());
  const context = await Effect.runPromise(
    Layer.build(layer).pipe(Scope.extend(scope))
  );

  const context_with_scope = Context.add(context, Scope.Scope, scope);
  const runtime = Runtime.make({
    ...Runtime.defaultRuntime,
    context: context_with_scope
  });
  const run = Runtime.runPromise(runtime);

  const effect_base_db = await run(JasonDB);

  const promise_based_collection = {} as {
    [K in keyof InferCollections<T>]: Collection<InferCollections<T>[K]>;
  };

  for (const name in effect_base_db.collections) {
    const effect_based_collection = effect_base_db.collections[name];

    promise_based_collection[name as keyof typeof promise_based_collection] =
      createPromiseClient(effect_based_collection, run);
  }

  return {
    collections: promise_based_collection,
    [Symbol.asyncDispose]: async () => {
      await Effect.runPromise(Scope.close(scope, Exit.void));
    }
  };
};
