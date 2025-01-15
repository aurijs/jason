import type { BaseDocument, ExtractDocument } from './document.js'
import type { ValidationFunction } from './utils.js'
import type { ConcurrencyStrategy } from './concurrency.js'

/**
 * Type to extract the document type from a collection
 */
export type CollectionDocument<
    T extends BaseCollections,
    K extends keyof T,
> = BaseDocument<ExtractDocument<T[K]>>;

/**
 * Base interface for collections map in JasonDB
 */
export interface BaseCollections {
    [key: string]: unknown[];
}


/**
 * Options for configuring a collection.
 *
 * @template T - The type of documents in the collection.
 * @property initialData - An optional array of initial data to populate the collection.
 * @property schema - An optional validation function for documents in the collection.
 * @property concurrencyStrategy - An optional concurrency strategy for the collection.
 * @property cacheTimeout - An optional cache timeout in milliseconds.
 */
export interface CollectionOptions<T = BaseDocument> {
    initialData?: T[];
    schema?: ValidationFunction<T>;
    concurrencyStrategy?: ConcurrencyStrategy;
    cacheTimeout?: number;
    generateMetadata?: boolean;
}
