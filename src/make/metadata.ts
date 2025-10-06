import { FileSystem } from "@effect/platform";
import { Effect, Ref } from "effect";
import { ConfigManager } from "../layers/config.js";
import { JsonFile } from "../layers/json-file.js";
import { Json } from "../layers/json.js";
import {
  type CollectionMetadata,
  CollectionMetadataSchema
} from "../types/metadata.js";

/**
 * Creates a MetadataService.
 *
 * - `created_at` - The timestamp when the collection was created.
 * - `updated_at` - The timestamp when the collection was last updated.
 * - `document_count` - The number of documents in the collection.
 *
 * @param collection_name The path to the metadata file.
 * @returns A MetadataService.
 */
export const makeMetadata = (collection_name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonService = yield* Json;
    const jsonFile = yield* JsonFile;
    const config = yield* ConfigManager;
    const metadata_path = yield* config.getMetadataPath(collection_name);

    /**
     * The metadata reference.
     */
    const metadata_ref = yield* Ref.make<CollectionMetadata>({
      created_at: new Date(),
      updated_at: new Date(),
      document_count: 0,
      indexes: {}
    });

    yield* Effect.gen(function* () {
      const metadata = yield* jsonFile.readJsonFile(
        metadata_path,
        CollectionMetadataSchema
      );

      yield* Ref.set(metadata_ref, metadata);
    }).pipe(
      Effect.catchTag("SystemError", (error) =>
        error.reason === "NotFound"
          ? Ref.get(metadata_ref).pipe(
              Effect.flatMap((initial_metadata) =>
                jsonFile.writeJsonFile(
                  metadata_path,
                  CollectionMetadataSchema,
                  initial_metadata
                )
              )
            )
          : Effect.fail(error)
      )
    );

    const persist = (meta: CollectionMetadata) =>
      jsonService
        .stringify(meta)
        .pipe(Effect.flatMap((s) => fs.writeFileString(metadata_path, s)));

    const incrementCount = Ref.updateAndGet(metadata_ref, (meta) => ({
      ...meta,
      document_count: meta.document_count + 1,
      updated_at: new Date()
    })).pipe(Effect.flatMap(persist), Effect.asVoid);

    const decrementCount = Ref.updateAndGet(metadata_ref, (meta) => ({
      ...meta,
      document_count: meta.document_count - 1,
      updated_at: new Date()
    })).pipe(Effect.flatMap(persist), Effect.asVoid);

    const touch = Ref.updateAndGet(metadata_ref, (meta) => ({
      ...meta,
      updated_at: new Date()
    })).pipe(Effect.flatMap(persist), Effect.asVoid);

    return {
      /** Returns the current metadata state */
      get: Ref.get(metadata_ref),

      /** Increments the document count and updates the timestamp */
      incrementCount,

      /** Decrements the document count and updates the timestamp. */
      decrementCount,

      /** Updates the 'updatedAt' timestamp */
      touch
    };
  });
