import { Effect } from "effect";
import { ConfigManager } from "./config.js";
import { makeBtreeService } from "./btree.js";

export const makeIndexService = <Doc extends { id?: string }>(
  index_name: string
) =>
  Effect.gen(function* () {
    const config = yield* ConfigManager;

    const collection_path = yield* config.getCollectionPath(index_name);
    const doc_schema = yield* config.getCollectionSchema(index_name);
    const index_definitions = yield* config.getIndexDefinitions(index_name);

    // For each field that needs being indexed, create a
    // B-tree service instance
    const btree_services = yield* Effect.all(
      Object.fromEntries(
        Object.entries(index_definitions).map(([field_name]) => {
          const key_schema = doc_schema.fields[field_name];
          if (!key_schema) {
            throw new Error(
              `Field ${field_name} does not exist in document schema`
            );
          }

          const btree_service_effect = makeBtreeService(
            `${collection_path}/${field_name}`,
            key_schema,
            8 // B-tree order
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
        Object.keys(index_definitions),
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
              // TODO: Remove old value from index
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
     * Finds the IDs of documents that match a given field value.
     * @param field_name The name of the field to search.
     * @param value The value to search for.
     * @returns An effect that returns the IDs of matching documents.
     */
    const findIds = (field_name: string, value: unknown) =>
      Effect.gen(function* () {
        const btree = btree_services[field_name];
        if (!btree) {
          return yield* Effect.fail(
            new Error(`Index on field ${field_name} does not exist`)
          );
        }

        // Delegate to B-tree service to find the document IDs
        const found_id = yield* btree.find(value as any);

        // Return an array of IDs (or empty array if not found)
        return found_id ? [found_id] : [];
      });

    return { update, findIds };
  });
