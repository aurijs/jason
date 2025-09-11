import { Context, Effect } from "effect";
import type { CollectionMetadata } from "../types/metadata.js";

export class MetadataService extends Context.Tag("MetadataService")<
  MetadataService,
  {
    /** Returns the current metadata state. */
    readonly get: Effect.Effect<never, never, CollectionMetadata>;

    /** Increments the document count and updates the timestamp. */
    readonly incrementCount: Effect.Effect<never, Error, void>;

    /** Decrements the document count and updates the timestamp. */
    readonly decrementCount: Effect.Effect<never, Error, void>;

    /** Updates the 'updatedAt' timestamp. */
    readonly touch: Effect.Effect<never, Error, void>;
  }
>() {}
