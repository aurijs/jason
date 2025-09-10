import type { Collection, CollectionEffect } from "./collection.js";

export interface DatabaseEffect<Collections extends Record<string, any>> {
  readonly collections: {
    [K in keyof Collections]: CollectionEffect<Collections[K]>;
  };
}

export interface Database<Collections extends Record<string, any>> {
  readonly collections: {
    [K in keyof Collections]: Collection<Collections[K]>;
  };
}
