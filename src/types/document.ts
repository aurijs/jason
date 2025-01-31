/**
 * Base data interface that all data should extend.
 *
 * @property id A unique identifier for the item.
 * @property _version The version number of the item. Only used by the versioning concurrency strategy.
 * @property _lastModified The last modified timestamp of the item. Only used by the versioning concurrency strategy.
 */
/**
 * Base data interface that all data should extend.
 *
 * @property id A unique identifier for the item.
 * @property _version The version number of the item. Only used by the versioning concurrency strategy.
 * @property _lastModified The last modified timestamp of the item. Only used by the versioning concurrency strategy.
 */
export type BaseDocument<T = Record<string, unknown>> = T & {
    id?: string;
    _version?: number;
    _lastModified?: number;
};

/**
 * Helper type to extract the document type from an array
 */
export type ExtractDocument<T> = T extends Array<infer D> ? D : never;

export type Document<T, K extends keyof T> = T[K] extends Array<infer U>
    ? BaseDocument<U>
    : never;


/**
 * Represents a database data type.
 *
 * @template T The type of data in the database.
 */
export type DatabaseData<T> = Record<string, T>;