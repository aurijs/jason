import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { DatabaseError } from "../core/errors.js";
import { ConfigManager } from "../layers/config.js";
import { makeIndexService } from "../layers/index.js";
import { WriteAheadLog } from "../layers/wal.js";
import type { BatchResult, Filter, QueryOptions } from "../types/collection.js";
import { makeMetadata } from "./metadata.js";
import { makeQuery } from "./query.js";
import { makeStorageManager } from "./storage-manager.js";

export const makeCollection = <Doc extends Record<string, any>>(
  collection_name: string
) =>
  Effect.gen(function* () {
    // load services
    const fs = yield* FileSystem.FileSystem;
    const config = yield* ConfigManager;
    const wal = yield* WriteAheadLog;

    // load path, schema and index
    const collection_path = yield* config.getCollectionPath(collection_name);
    const cache_config = yield* config.getCacheConfig;

    // make index if it's non existent
    yield* fs.makeDirectory(collection_path, { recursive: true });

    const storage = yield* makeStorageManager<Doc>(collection_name, {
      cacheCapacity: cache_config?.document_capacity
    });
    const indexService = yield* makeIndexService(collection_name);
    const metadataService = yield* makeMetadata(collection_name);
    const queryManager = yield* makeQuery<Doc>(
      collection_name,
      indexService,
      storage
    );

    return {
      batch: {
        insert: (docs: Doc[]) =>
          Effect.gen(function* () {
            const results: BatchResult = { success: 0, failures: [] };

            const tasks = docs.map((data, i) =>
              Effect.gen(function* () {
                const id = (data.id as string) ?? crypto.randomUUID();
                const new_document = { ...data, id } as Doc;

                yield* storage.write(id, new_document);

                yield* Effect.all(
                  [
                    metadataService.incrementCount,
                    indexService.update(undefined, new_document)
                  ],
                  { discard: true, concurrency: "unbounded" }
                );

                results.success++;
                return {
                  _tag: "CreateOp",
                  collection: collection_name,
                  data: new_document
                } as const;
              }).pipe(
                Effect.catchAll((error) => {
                  results.failures.push({
                    index: i,
                    error: error.toString()
                  });
                  return Effect.succeed(null);
                })
              )
            );

            const ops = yield* Effect.all(tasks, { concurrency: "unbounded" }).pipe(
              Effect.map((results) => results.filter((op): op is NonNullable<typeof op> => op !== null))
            );

            if (ops.length > 0) {
              yield* wal.log({
                _tag: "BatchOp",
                collection: collection_name,
                operations: ops
              });
            }

            return results;
          }).pipe(
            Effect.mapError(
              (cause) =>
                new DatabaseError({ message: "Failed to insert batch", cause })
            )
          ),
        delete: (filter: Filter<Doc>) =>
          Effect.gen(function* () {
            const docs_to_delete = yield* queryManager.find({ where: filter });
            const results: BatchResult = { success: 0, failures: [] };
            const ops: any[] = [];
            const tasks: Effect.Effect<void, never>[] = [];

            for (let i = 0; i < docs_to_delete.length; i++) {
              const doc = docs_to_delete[i];
              const id = doc.id;

              ops.push({
                _tag: "DeleteOp",
                collection: collection_name,
                id
              });

              const post_write = Effect.all(
                [
                  storage.remove(id),
                  metadataService.decrementCount,
                  indexService.update(doc, undefined)
                ],
                { discard: true, concurrency: "unbounded" }
              ).pipe(
                Effect.match({
                  onSuccess: () => {
                    results.success++;
                  },
                  onFailure: (error) => {
                    results.failures.push({
                      id,
                      error: error.toString()
                    });
                  }
                })
              );
              tasks.push(post_write);
            }

            if (ops.length > 0) {
              yield* wal.log({
                _tag: "BatchOp",
                collection: collection_name,
                operations: ops
              } as any);

              yield* Effect.all(tasks, { concurrency: "unbounded" });
            }

            return results;
          }).pipe(
            Effect.mapError(
              (cause) =>
                new DatabaseError({ message: "Failed to delete batch", cause })
            )
          ),
        update: (filter: Filter<Doc>, data: Partial<Omit<Doc, "id">>) =>
          Effect.gen(function* () {
            const docs_to_update = yield* queryManager.find({ where: filter });
            const results: BatchResult = { success: 0, failures: [] };
            const ops: any[] = [];
            const tasks: Effect.Effect<void, never>[] = [];

            for (let i = 0; i < docs_to_update.length; i++) {
              const old_document = docs_to_update[i];
              const id = old_document.id;
              const new_document = { ...old_document, ...data } as Doc;

              ops.push({
                _tag: "UpdateOp",
                collection: collection_name,
                id,
                data
              });

              const post_write = Effect.all(
                [
                  storage.write(id, new_document),
                  metadataService.touch,
                  indexService.update(old_document, new_document)
                ],
                { discard: true, concurrency: "unbounded" }
              ).pipe(
                Effect.match({
                  onSuccess: () => {
                    results.success++;
                  },
                  onFailure: (error) => {
                    results.failures.push({
                      id,
                      error: error.toString()
                    });
                  }
                })
              );
              tasks.push(post_write);
            }

            if (ops.length > 0) {
              yield* wal.log({
                _tag: "BatchOp",
                collection: collection_name,
                operations: ops
              } as any);

              yield* Effect.all(tasks, { concurrency: "unbounded" });
            }

            return results;
          }).pipe(
            Effect.mapError(
              (cause) =>
                new DatabaseError({ message: "Failed to update batch", cause })
            )
          )
      },

      find: queryManager.find,

      create: (data: Doc) =>
        Effect.gen(function* () {
          const id = (data.id as string) ?? crypto.randomUUID();
          const new_document = { ...data, id } as Doc;

          // Perform storage write first to ensure validation passes before logging to WAL
          // Actually, WAL should probably be first for durability, but if validation fails,
          // we don't want it in WAL.
          // Let's do validation explicitly if we want, or just let storage.write handle it.

          yield* storage.write(id, new_document);

          yield* wal.log({
            _tag: "CreateOp",
            collection: collection_name,
            data: new_document
          });

          yield* Effect.all(
            [
              metadataService.incrementCount,
              indexService.update(undefined, new_document)
            ],
            { discard: true, concurrency: "unbounded" }
          );

          return new_document;
        }).pipe(
          Effect.mapError(
            (cause) =>
              new DatabaseError({ message: "Failed to create document", cause })
          )
        ),

      findById: storage.read,

      update: (id: string, data: Partial<Doc>) =>
        Effect.gen(function* () {
          const old_document = yield* storage.read(id);
          if (!old_document) return undefined;

          const new_document = {
            ...old_document,
            ...data
          } as Doc;

          yield* storage.write(id, new_document);

          yield* wal.log({
            _tag: "UpdateOp",
            collection: collection_name,
            id,
            data
          });

          yield* Effect.all(
            [
              metadataService.touch,
              indexService.update(old_document, new_document)
            ],
            { concurrency: "unbounded", discard: true }
          );

          return new_document;
        }).pipe(
          Effect.mapError(
            (cause) =>
              new DatabaseError({
                message: `Failed to update document ${id}`,
                cause
              })
          )
        ),

      delete: (id: string) =>
        Effect.gen(function* () {
          const old_document = yield* storage.read(id);
          if (!old_document) return false;

          yield* wal.log({
            _tag: "DeleteOp",
            collection: collection_name,
            id
          });

          yield* storage.remove(id);

          yield* Effect.all(
            [
              metadataService.decrementCount,
              indexService.update(old_document, undefined)
            ],
            { concurrency: "unbounded", discard: true }
          );

          return true;
        }).pipe(
          Effect.mapError(
            (cause) =>
              new DatabaseError({
                message: `Failed to delete document ${id}`,
                cause
              })
          )
        ),
      findOne: (options: QueryOptions<Doc>) =>
        queryManager
          .find({ ...options, limit: 1 })
          .pipe(Effect.map((docs) => docs[0])),

      has: storage.exists,
      count: metadataService.get.pipe(Effect.map((m) => m.document_count)),
      getMetadata: metadataService.get
    };
  });
