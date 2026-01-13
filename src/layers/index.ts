import { Effect } from "effect";
import { ConfigManager } from "./config.js";
import { makeBtreeService } from "../make/btree.js";

export const makeIndexService = <Doc extends { id?: string }>(
  index_name: string
) =>
  Effect.gen(function* () {
    const config = yield* ConfigManager;

    const collection_path = yield* config.getCollectionPath(index_name);
    const doc_schema = yield* config.getCollectionSchema(index_name);
    const index_definitions = yield* config.getIndexDefinitions(index_name);
    const cache_config = yield* config.getCacheConfig;

    // For each field that needs being indexed, create a
    // B-tree service instance
    const btree_services = yield* Effect.all(
      Object.fromEntries(
        Object.entries(index_definitions)
          .filter(
            ([_, def]) =>
              def.indexed || def.unique || def.primary_key || def.multi_entry
          )
          .map(([field_name]) => {
            const key_schema =
              "fields" in doc_schema
                ? (doc_schema as any).fields[field_name]
                : undefined;
            if (!key_schema) {
              throw new Error(
                `Field ${field_name} does not exist in document schema or automatic indexing is not supported for this schema type`
              );
            }

            const btree_service_effect = makeBtreeService(
              `${collection_path}/${field_name}`,
              key_schema,
              8, // B-tree order
              cache_config?.index_capacity
            );
            return [field_name, btree_service_effect];
          })
      )
    );

    /**
     * Updates the index for a document.
     * @param old_doc The old document.
     * @param new_doc The new document.
     * @returns An effect that updates the index.
     */
    const update = (old_doc: Doc | undefined, new_doc: Doc | undefined) =>
      Effect.forEach(
        Object.keys(btree_services),
        (field_name) =>
          Effect.gen(function* () {
            const btree = btree_services[field_name];
            const old_value = old_doc?.[field_name as keyof Doc];
            const new_value = new_doc?.[field_name as keyof Doc];

            // If the value didn't change, do nothing
            if (old_value === new_value) {
              return;
            }

            if (old_value !== undefined) {
              yield* btree.delete(old_value as any);
            }

            // Insert new value into index
            // The key is the value of the field (ex: 'test@email.com')
            // The value is always the main document ID.
            if (new_value !== undefined) {
              yield* btree.insert(new_value as any, new_doc?.id);
            }
          }),
        { discard: true, concurrency: "inherit" }
      );

    /**
     * Finds all IDs of documents that match a given field value.
     * @param field_name The name of the field to search.
     * @param value The value to search for.
     * @returns An effect that returns the IDs of matching documents.
     */
    const findAllIds = (field_name: string, value: unknown) =>
      Effect.gen(function* () {
        const btree = btree_services[field_name];
        if (!btree) {
          return yield* Effect.fail(
            new Error(`Index on field ${field_name} does not exist`)
          );
        }

        return yield* btree.findAll(value as any);
      });

    /**
     * Finds all key-value pairs within a specified range on an indexed field.
     * @param field_name The name of the field to search.
     * @param options Range options.
     * @returns An effect that returns the key-value pairs within the range.
     */
    const findRange = (
      field_name: string,
      options: {
        min?: any;
        max?: any;
        minInclusive?: boolean;
        maxInclusive?: boolean;
      }
    ) =>
      Effect.gen(function* () {
        const btree = btree_services[field_name];
        if (!btree) {
          return yield* Effect.fail(
            new Error(`Index on field ${field_name} does not exist`)
          );
        }

        return yield* btree.findRange(options);
      });

    return { update, findAllIds, findRange };
  });
