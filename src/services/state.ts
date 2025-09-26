import { Context, type Effect } from "effect";
import type { CollectionEffect } from "../types/collection.js";
import type { WALOperation } from "../types/wal.js";

export interface State {
  /**
   * Get a collection by name, creating it if it doesn't exist.
   * @param name collection name
   * @returns an effect that resolves to a collection instance
   */
  readonly getCollection: (
    name: string
  ) => Effect.Effect<CollectionEffect<any>, Error>;

  /**
   * Apply an unique opration from WAL into State
   */
  readonly apply: (op: WALOperation) => Effect.Effect<void, Error>;
}

export class StateService extends Context.Tag("StateService")<
  StateService,
  State
>() {}
