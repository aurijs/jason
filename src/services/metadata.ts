import { Context, Effect } from "effect";
import type { CollectionMetadata } from "../types/metadata.js";

export class MetadataService extends Context.Tag("MetadataService")<
  MetadataService,
  {
    /** Returns the current metadata state. */
    readonly get: Effect.Effect<CollectionMetadata>;

    /** Increments the document count and updates the timestamp. */
    readonly incrementCount: Effect.Effect<void, Error>;

    /** Decrements the document count and updates the timestamp. */
    readonly decrementCount: Effect.Effect<void, Error>;

    /** Updates the 'updatedAt' timestamp. */
    readonly touch: Effect.Effect<void, Error>;
  }
>() {}
