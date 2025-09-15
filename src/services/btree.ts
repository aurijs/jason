import { Context, Effect } from "effect";

export const BTreeService = <K, V>() =>
  Context.Tag("BTreeService")<
    typeof BTreeService,
    {
      /** Insert a key-value pair into the tree. */
      readonly insert: (key: K, value: V) => Effect.Effect<void, Error>;
      /** Finds the value associated with a key. */
      readonly find: (key: K) => Effect.Effect<V | undefined, Error>;
      /** Removes a key (and its value) from the tree. */
      readonly remove: (key: K) => Effect.Effect<boolean, Error>;
      /** (Optional, but powerful) Performs a range search. */
      readonly findRange: (startKey: K, endKey: K) => Effect.Effect<V[], Error>;
    }
  >();
