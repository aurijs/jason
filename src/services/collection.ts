import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { DatabaseError } from "../core/errors.js";
import { makeIndexService } from "../layers/index.js";
import { makeMetadata } from "../layers/metadata.js";
import type {
  CollectionEffect,
  Filter,
  QueryOptions
} from "../types/collection.js";
import type { IndexDefinition } from "../types/metadata.js";
import { ConfigManager } from "../layers/config.js";
import { JsonFile } from "../layers/json-file.js";
import { WriteAheadLog } from "../layers/wal.js";

export const makeCollection = <Doc extends Record<string, any>>(
  collection_name: string
) =>
  Effect.gen(function* () {
    // load services
    const fs = yield* FileSystem.FileSystem;
    const jsonFile = yield* JsonFile;
    const config = yield* ConfigManager;
    const wal = yield* WriteAheadLog;

    // load path, schema and index
    const schema = yield* config.getCollectionSchema(collection_name);
    const IndexDefinitions = yield* config.getIndexDefinitions(collection_name);
    const collection_path = yield* config.getCollectionPath(collection_name);

    // make index if it's non existent
    yield* fs.makeDirectory(collection_path, { recursive: true });

    const indexService = yield* makeIndexService(collection_name);
    const metadataService = yield* makeMetadata(collection_name);

    const loadAll = Effect.gen(function* () {
      const files = yield* fs.readDirectory(collection_path);

      const docs = yield* Effect.all(
        files
          .filter((file) => !file.startsWith("_"))
          .map((file) =>
            jsonFile.readJsonFile(`${collection_path}/${file}`, schema)
          )
      );
      return docs as Doc[];
    }).pipe(
      Effect.mapError(
        (cause) =>
          new DatabaseError({ message: "Failed to load collection", cause })
      )
    );

    const create = (data: Doc) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID() as string;
        const document_path = `${collection_path}/${id}.json`;
        const new_document = { ...data, id } as Doc;

        yield* wal.log({
          _tag: "CreateOp",
          collection: collection_name,
          data: new_document
        });

        yield* jsonFile.writeJsonFile(document_path, schema, new_document);

        yield* Effect.all([
          metadataService.incrementCount,
          indexService.update(undefined, new_document)
        ]);

        return new_document;
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DatabaseError({ message: "Failed to create document", cause })
        )
      );

    const findById = (id: string) =>
      jsonFile
        .readJsonFile(`${collection_path}/${id}.json`, schema)
        .pipe(
          Effect.catchTag("SystemError", (e) =>
            e.reason === "NotFound" ? Effect.succeed(undefined) : Effect.fail(e)
          )
        );

    const has = (id: string) => fs.exists(`${collection_path}/${id}.json`);

    const update = (id: string, data: Partial<Doc>) =>
      Effect.gen(function* () {
        const old_document = yield* findById(id);
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

        yield* jsonFile.writeJsonFile(
          `${collection_path}/${id}.json`,
          schema,
          new_document
        );

        yield* Effect.all([
          metadataService.touch,
          indexService.update(old_document, new_document)
        ]);
        return new_document;
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DatabaseError({
              message: `Failed to update document ${id}`,
              cause
            })
        )
      );

    const deleteFn = (id: string) =>
      Effect.gen(function* () {
        const old_document = yield* findById(id);
        if (!old_document) return false;

        yield* fs.remove(`${collection_path}/${id}.json`);

        yield* Effect.all([
          metadataService.decrementCount,
          indexService.update(old_document, undefined)
        ]);
        return true;
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DatabaseError({
              message: `Failed to delete document ${id}`,
              cause
            })
        )
      );

    function findBestIndex(
      where: Filter<Doc>,
      definitions: Record<string, IndexDefinition>
    ) {
      for (const field in where) {
        // Check if the current field from the 'where' clause has an associated index definition.
        if (Object.prototype.hasOwnProperty.call(definitions, field)) {
          // If an index is found for this field, return a plan to use this index.
          return {
            type: "index" as const, // the "as const" helps with inference
            field: field as keyof Doc,
            value: where[field as keyof Doc]
          };
        }
      }

      // If no suitable index is found for any field in the 'where' clause,
      // return a plan indicating that a full scan of the collection is necessary.
      return { type: "full-scan" as const };
    }

    const find = (options: QueryOptions<Doc>) =>
      Effect.gen(function* () {
        let initial_docs: Doc[] = [];

        if (options.where && Object.keys(options.where).length > 0) {
          const plan = findBestIndex(options.where, IndexDefinitions);

          if (plan.type === "index") {
            const ids = yield* indexService.findIds(
              String(plan.field),
              plan.value
            );
            const results = yield* Effect.all(ids.map((id) => findById(id)));
            initial_docs = results.filter(
              (doc): doc is Doc => doc !== undefined
            );
          } else {
            initial_docs = yield* loadAll;
          }
        } else {
          initial_docs = yield* loadAll;
        }

        let final_results = initial_docs;

        if (options.where) {
          final_results = final_results.filter((doc) => {
            for (const key in options.where) {
              if (doc[key as keyof Doc] !== options.where[key as keyof Doc]) {
                return false;
              }
            }
            return true;
          });
        }

        if (options.order_by) {
          const { field, order } = options.order_by;
          final_results.sort((a, b) => {
            if (a[field] < b[field]) return order === "asc" ? -1 : 1;
            if (a[field] > b[field]) return order === "asc" ? 1 : -1;
            return 0;
          });
        }

        // Aplica a paginação
        const skip = options.skip ?? 0;
        const limit = options.limit ?? Number.POSITIVE_INFINITY;
        return final_results.slice(skip, skip + limit);
      });

    const findOne = (options: QueryOptions<Doc>) =>
      find({ ...options, limit: 1 }).pipe(Effect.map((docs) => docs[0]));

    const count = metadataService.get.pipe(Effect.map((m) => m.document_count));
    const getMetadata = metadataService.get;

    return {
      create,
      findById,
      update,
      delete: deleteFn,
      find,
      findOne,
      has,
      count,
      getMetadata
    } as CollectionEffect<Doc>;
  });
