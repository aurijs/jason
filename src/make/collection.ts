import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { DatabaseError } from "../core/errors.js";
import { ConfigManager } from "../layers/config.js";
import { makeIndexService } from "../layers/index.js";
import { WriteAheadLog } from "../layers/wal.js";
import type { QueryOptions } from "../types/collection.js";
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
    const storage = yield* makeStorageManager<Doc>(collection_name);
    const queryManager = yield* makeQuery<Doc>(collection_name);

    // load path, schema and index
    const collection_path = yield* config.getCollectionPath(collection_name);

    // make index if it's non existent
    yield* fs.makeDirectory(collection_path, { recursive: true });

    const indexService = yield* makeIndexService(collection_name);
    const metadataService = yield* makeMetadata(collection_name);

    return {
      find: queryManager.find,

      create: (data: Doc) =>
        Effect.gen(function* () {
          const id = crypto.randomUUID() as string;
          const new_document = { ...data, id } as Doc;

          yield* wal.log({
            _tag: "CreateOp",
            collection: collection_name,
            data: new_document
          });

          yield* storage.write(id, new_document);

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

          yield* wal.log({
            _tag: "UpdateOp",
            collection: collection_name,
            id,
            data
          });

          yield* storage.write(id, new_document);

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
