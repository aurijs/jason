import { FileSystem } from "@effect/platform";
import { Effect, Ref, Schema } from "effect";
import { JsonService } from "../services/json.js";
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
 * @param metadata_path The path to the metadata file.
 * @returns A MetadataService.
 */
export const makeMetadata = (metadata_path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonService = yield* JsonService;

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
      const content = yield* fs.readFileString(metadata_path);
      const json = yield* jsonService.parse(content);
      const metadata = yield* Schema.decode(CollectionMetadataSchema)(json);
      yield* Ref.set(metadata_ref, metadata);
    }).pipe(
      Effect.catchTag("SystemError", (error) =>
        error.reason === "NotFound"
          ? Ref.get(metadata_ref).pipe(
              Effect.flatMap((m) => jsonService.stringify(m)),
              Effect.flatMap((s) => fs.writeFileString(metadata_path, s))
            )
          : Effect.fail(error)
      )
    );

    const persist = (meta: CollectionMetadata) =>
      jsonService
        .stringify(meta)
        .pipe(Effect.flatMap((s) => fs.writeFileString(metadata_path, s)));

    /**
     * Increments the document count and updates the timestamp.
     */
    const incrementCount = Ref.updateAndGet(metadata_ref, (meta) => ({
      ...meta,
      document_count: meta.document_count + 1,
      updated_at: new Date()
    })).pipe(Effect.flatMap(persist), Effect.asVoid);

    /**
     * Decrements the document count and updates the timestamp.
     */
    const decrementCount = Ref.updateAndGet(metadata_ref, (meta) => ({
      ...meta,
      document_count: meta.document_count - 1,
      updated_at: new Date()
    })).pipe(Effect.flatMap(persist), Effect.asVoid);

    /**
     * Updates the 'updated_at' timestamp.
     */
    const touch = Ref.updateAndGet(metadata_ref, (meta) => ({
      ...meta,
      updated_at: new Date()
    })).pipe(Effect.flatMap(persist), Effect.asVoid);

    return {
      get: Ref.get(metadata_ref),
      incrementCount,
      decrementCount,
      touch
    };
  });
