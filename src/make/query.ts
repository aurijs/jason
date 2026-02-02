import { Effect, Stream } from "effect";
import { ConfigManager } from "../layers/config.js";
import type { Filter, QueryOptions } from "../types/collection.js";
import type { IndexDefinition } from "../types/metadata.js";

import type { ComparisonOperator } from "../types/query.js";

export function evaluateFilter<Doc>(doc: Doc, filter: Filter<Doc>): boolean {
  if ("_tag" in filter) {
    switch (filter._tag) {
      case "and":
        return filter.filters.every((f) => evaluateFilter(doc, f as any));
      case "or":
        return filter.filters.some((f) => evaluateFilter(doc, f as any));
      case "not":
        return !evaluateFilter(doc, filter.filter as any);
    }
  }

  for (const key in filter) {
    const filterValue = (filter as any)[key];
    const docValue = (doc as any)[key];

    if (
      filterValue !== null &&
      typeof filterValue === "object" &&
      "_tag" in filterValue
    ) {
      const op = filterValue as ComparisonOperator<any>;
      switch (op._tag) {
        case "eq":
          if (docValue !== op.value) return false;
          break;
        case "ne":
          if (docValue === op.value) return false;
          break;
        case "gt":
          if (!(docValue > op.value)) return false;
          break;
        case "gte":
          if (!(docValue >= op.value)) return false;
          break;
        case "lt":
          if (!(docValue < op.value)) return false;
          break;
        case "lte":
          if (!(docValue <= op.value)) return false;
          break;
        case "in":
          if (!op.values.includes(docValue)) return false;
          break;
        case "nin":
          if (op.values.includes(docValue)) return false;
          break;
        case "startsWith":
          if (typeof docValue !== "string" || !docValue.startsWith(op.value))
            return false;
          break;
        case "regex": {
          const re = new RegExp(op.pattern, op.flags);
          if (typeof docValue !== "string" || !re.test(docValue)) return false;
          break;
        }
      }
    } else {
      // Simple equality
      if (docValue !== filterValue) return false;
    }
  }

  return true;
}

export const makeQuery = <Doc extends Record<string, any>>(
  collection_name: string,
  index: any,
  storage: {
    read: (id: string) => Effect.Effect<Doc | undefined, any>;
    readAll: Stream.Stream<Doc, any>;
  }
) =>
  Effect.gen(function* () {
    const config = yield* ConfigManager;
    const IndexDefinitions = yield* config.getIndexDefinitions(collection_name);

    function findBestIndex(
      where: Filter<Doc>,
      definitions: Record<string, IndexDefinition>
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

      for (const field in where) {
        if (Object.prototype.hasOwnProperty.call(definitions, field)) {
          const def = definitions[field];
          if (
            !(def.indexed || def.unique || def.primary_key || def.multi_entry)
          )
            continue;

          const filterValue = (where as any)[field];

          if (
            filterValue !== null &&
            typeof filterValue === "object" &&
            "_tag" in filterValue
          ) {
            const op = filterValue as ComparisonOperator<any>;
            switch (op._tag) {
              case "eq":
                return { type: "index", field, value: op.value };
              case "gt":
                return {
                  type: "range",
                  field,
                  options: { min: op.value, minInclusive: false }
                };
              case "gte":
                return {
                  type: "range",
                  field,
                  options: { min: op.value, minInclusive: true }
                };
              case "lt":
                return {
                  type: "range",
                  field,
                  options: { max: op.value, maxInclusive: false }
                };
              case "lte":
                return {
                  type: "range",
                  field,
                  options: { max: op.value, maxInclusive: true }
                };
            }
          } else if (typeof filterValue !== "object" || filterValue === null) {
            return { type: "index", field, value: filterValue };
          }
        }
      }

      return { type: "full-scan" };
    }

    return {
      find: (options: QueryOptions<Doc>) =>
        Effect.gen(function* () {
          let initial_docs: Doc[] = [];

          if (options.where && Object.keys(options.where).length > 0) {
            const plan = findBestIndex(options.where, IndexDefinitions);

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
            final_results = final_results.filter((doc) =>
              evaluateFilter(doc, options.where)
            );
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
