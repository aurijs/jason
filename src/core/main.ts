import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer, Ref, Runtime } from "effect";
import { readdir } from "node:fs/promises";
import path from "node:path";
import Collection from "../data/collection.js";
import type {
  CollectionOptions,
  Document,
  JasonDBOptions,
} from "../types/index.js";
import { DatabaseError } from "./errors.js";

const ensureDataDirExists = (base_path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const exists = yield* fs.exists(base_path).pipe(
      Effect.catchTag("SystemError", (error) => {
        if (error.reason === "NotFound") return Effect.succeed(false);
        return Effect.succeed(true);
      })
    );

    if (!exists) {
      yield* fs.makeDirectory(base_path);
    }
  });

const make = <T>(
  base_path: string,
  collections_ref: Ref.Ref<Map<keyof T, Collection<T, keyof T>>>
) => {
  const collectionEffect = <K extends keyof T>(
    name: K,
    options: CollectionOptions<Document<T, K>> = {}
  ) =>
    Ref.get(collections_ref).pipe(
      Effect.flatMap((existing_collections) => {
        if (existing_collections.has(name)) {
          return Effect.succeed(
            existing_collections.get(name) as Collection<T, K>
          );
        }
        const new_collection = new Collection<T, K>(base_path, name, options);

        return Ref.updateAndGet(collections_ref, (map) =>
          map.set(name, new_collection)
        ).pipe(Effect.map(() => new_collection));
      })
    );

  const listCollectionsEffect = Effect.gen(function* () {
    const existing_collections = yield* collections_ref.get;
    if (existing_collections.size > 0) {
      return Array.from(existing_collections.keys());
    }

    const entries = yield* Effect.tryPromise({
      try: async () => {
        const entries = await readdir(base_path, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
          .map((entry) => entry.name) as (keyof T)[];
      },
      catch: () => {
        return [];
      },
    });

    return entries;
  });

  return { collectionEffect, listCollectionsEffect };
};

/**
 * Creates a new JasonDB instance with the given configuration.
 * @param options - Either a string representing the database name (will be created in current working directory),
 *                 or a JasonDBOptions configuration object
 * @example
 * // Simple usage
 * const db = await JasonDB('my-database');
 *
 * // Advanced usage
 * const db = await JasonDB({
 *   basename: 'my-database',
 *   path: './custom-location'
 * });
 */
export async function Jason<T>(options: string | JasonDBOptions) {
  const program = Effect.gen(function* () {
    const base_path =
      typeof options === "string"
        ? path.join(path.resolve("."), options)
        : path.join(path.resolve(options.path), options.basename);

    const collections_ref = yield* Ref.make(
      new Map<keyof T, Collection<T, keyof T>>()
    );

    const runtime = yield* Effect.runtime<FileSystem.FileSystem>();

    yield* ensureDataDirExists(base_path);

    const { collectionEffect, listCollectionsEffect } = make<T>(
      base_path,
      collections_ref
    );

    return {
      /**
       * Retrieves or creates a collection in the database.
       *
       * If a collection with the given name does not exist, it initializes a new collection
       * with the provided options and stores it. If the collection already exists, it returns the existing one.
       *
       * @param name - The name of the collection.
       * @param options - Optional settings for the collection.
       * @param options.initialData - An array of initial data to populate the collection.
       * @param options.schema - A validation function for the collection's documents.
       * @param options.concurrencyStrategy - The concurrency strategy to use for the collection.
       * @param options.cacheTimeout - The cache timeout in milliseconds.
       * @param options.generateMetadata - Whether to generate metadata for the collection.
       * @param options.indices - An optional string of index definitions for the collection (e.g., ['++id', '&email', '*tags']).
       * @returns The collection instance associated with the given name.
       */
      collection: <K extends keyof T>(
        name: K,
        options?: CollectionOptions<Document<T, K>>
      ) => Runtime.runPromise(runtime)(collectionEffect(name, options)),

      /**
       * List all collections in the database
       */
      listCollections: () => Runtime.runPromise(runtime)(listCollectionsEffect),
    };
  });

  const AppLayer = Layer.mergeAll(NodeFileSystem.layer);

  return Effect.runPromise(program.pipe(Effect.provide(AppLayer))).catch(
    (error) => {
      throw new DatabaseError({
        message: "Error initializing Database",
        cause: error,
      });
    }
  );
}
