import type { BaseDocument, Document, ExtractDocument } from "./document.js";
import type { ValidationFunction } from "./utils.js";

/**
 * Type to extract the document type from a collection
 */
export type CollectionDocument<
  T extends BaseCollections,
  K extends keyof T
> = BaseDocument<ExtractDocument<T[K]>>;

/**
 * Base interface for collections map in JasonDB
 */
export interface BaseCollections {
  [key: string]: unknown[];
}

export type CollectionParam<
  Collections,
  T extends keyof Collections
> = Omit<Document<Collections, T>, "id" | "_lastModified"> &
  Partial<Pick<Document<Collections, T>, "id" | "_lastModified">>;

/**
 * Options for configuring a collection.
 *
 * @template T - The type of documents in the collection.
 * @property initialData - An optional array of initial data to populate the collection.
 * @property schema - An optional validation function for documents in the collection.
 * @property concurrencyStrategy - An optional concurrency strategy for the collection.
 * @property cacheTimeout - An optional cache timeout in milliseconds.
 * @property generateMetadata - An optional flag to generate metadata for documents in the collection.
 */
export interface CollectionOptions<T = BaseDocument> {
  initialData?: T[];
  schema?: ValidationFunction<T>;
  cacheTimeout?: number;
  generateMetadata?: boolean;
}
