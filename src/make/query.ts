import { Effect, Stream } from "effect";
import { ConfigManager } from "../layers/config.js";
import { makeIndexService } from "../layers/index.js";
import type { Filter, QueryOptions } from "../types/collection.js";
import type { IndexDefinition } from "../types/metadata.js";
import { makeStorageManager } from "./storage-manager.js";

export const makeQuery = <Doc extends Record<string, any>>(
  collection_name: string
) =>
  Effect.gen(function* () {
    const config = yield* ConfigManager;
    const IndexDefinitions = yield* config.getIndexDefinitions(collection_name);

    const index = yield* makeIndexService(collection_name);
    const storage = yield* makeStorageManager<Doc>(collection_name);

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

    return {
      find: (options: QueryOptions<Doc>) =>
        Effect.gen(function* () {
          let initial_docs: Doc[] = [];

          if (options.where && Object.keys(options.where).length > 0) {
            const plan = findBestIndex(options.where, IndexDefinitions);

            if (plan.type === "index") {
              const ids = yield* index.findIds(String(plan.field), plan.value);
              const results = yield* Effect.all(
                ids.map((id) => storage.read(id))
              );
              initial_docs = results.filter(
                (doc): doc is Doc => doc !== undefined
              );
            } else {
              initial_docs = Array.from(yield* Stream.runCollect(storage.readAll));
            }
          } else {
            initial_docs = Array.from(yield* Stream.runCollect(storage.readAll));
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
        })
    };
  });