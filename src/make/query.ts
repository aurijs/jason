import { Effect, Stream } from "effect";
import { ConfigManager } from "../layers/config.js";
import type { Filter, QueryOptions } from "../types/collection.js";
import type { CollectionMetadata, IndexDefinition } from "../types/metadata.js";

import type { ComparisonOperator } from "../types/query.js";

// ... (REGEXP_CACHE and getRegExp remain the same)

export const makeQuery = <Doc extends Record<string, any>>(
  collection_name: string,
  index: any,
  storage: {
    read: (id: string) => Effect.Effect<Doc | undefined, any>;
    readAll: Stream.Stream<Doc, any>;
  },
  metadata: {
    get: Effect.Effect<CollectionMetadata, any>;
  }
) =>
  Effect.gen(function* () {
    const config = yield* ConfigManager;

    function findBestIndex(
      where: Filter<Doc>,
      definitions: Record<string, IndexDefinition>,
      document_count: number
    ):
      | { type: "full-scan" }
      | { type: "index"; field: string; value: any }
      | {
          type: "range";
          field: string;
          options: {
            min?: any;
            max?: any;
            minInclusive?: boolean;
            maxInclusive?: boolean;
          };
        } {
      if ("_tag" in where) return { type: "full-scan" };

      let bestPlan: any = { type: "full-scan" };
      let bestScore = -1;

      for (const field in where) {
        if (Object.prototype.hasOwnProperty.call(definitions, field)) {
          const def = definitions[field];
          if (
            !(def.indexed || def.unique || def.primary_key || def.multi_entry)
          )
            continue;

          let score = 1;
          if (def.primary_key) score = 1000;
          else if (def.unique) score = 500;
          else if (def.distinct_values !== undefined && document_count > 0) {
            // Selectivity = distinct_values / total_rows.
            // A higher number of distinct values means the index is more restrictive.
            score = Math.floor((def.distinct_values / document_count) * 100);
          }

          const filterValue = (where as any)[field];

          if (
            filterValue !== null &&
            typeof filterValue === "object" &&
            "_tag" in filterValue
          ) {
            const op = filterValue as ComparisonOperator<any>;
            switch (op._tag) {
              case "eq":
                if (score > bestScore) {
                  bestPlan = { type: "index", field, value: op.value };
                  bestScore = score;
                }
                break;
              case "gt":
              case "gte":
              case "lt":
              case "lte":
                // Range queries are generally less selective than point lookups
                const rangeScore = score * 0.5;
                if (rangeScore > bestScore) {
                  bestPlan = {
                    type: "range",
                    field,
                    options: {
                      min:
                        op._tag === "gt" || op._tag === "gte"
                          ? op.value
                          : undefined,
                      minInclusive: op._tag === "gte",
                      max:
                        op._tag === "lt" || op._tag === "lte"
                          ? op.value
                          : undefined,
                      maxInclusive: op._tag === "lte"
                    }
                  };
                  bestScore = rangeScore;
                }
                break;
            }
          } else if (typeof filterValue !== "object" || filterValue === null) {
            if (score > bestScore) {
              bestPlan = { type: "index", field, value: filterValue };
              bestScore = score;
            }
          }
        }
      }

      return bestPlan;
    }

    return {
      find: (options: QueryOptions<Doc>) =>
        Effect.gen(function* () {
          const currentMetadata = yield* metadata.get;
          const indexDefinitions = {
            ...(yield* config.getIndexDefinitions(collection_name)),
            ...(currentMetadata.indexes || {})
          };

          let initial_docs: Doc[] = [];

          if (options.where && Object.keys(options.where).length > 0) {
            const plan = findBestIndex(
              options.where,
              indexDefinitions,
              currentMetadata.document_count
            );

            if (plan.type === "index") {
              const ids = yield* index.findAllIds(plan.field, plan.value);
              const results = yield* Effect.all(
                ids.map((id: string) => storage.read(id))
              );
              initial_docs = results.filter(
                (doc): doc is Doc => doc !== undefined
              ) as Doc[];
            } else if (plan.type === "range") {
              const pairs = yield* index.findRange(plan.field, plan.options);
              const results = yield* Effect.all(
                pairs.map((p: any) => storage.read(p.value))
              );
              initial_docs = results.filter(
                (doc): doc is Doc => doc !== undefined
              ) as Doc[];
            } else {
              initial_docs = Array.from(
                yield* Stream.runCollect(storage.readAll)
              ) as Doc[];
            }
          } else {
            initial_docs = Array.from(
              yield* Stream.runCollect(storage.readAll)
            ) as Doc[];
          }

          let final_results = initial_docs;

          if (options.where) {
            const filterFn = compileFilter(options.where);
            final_results = final_results.filter(filterFn);
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
