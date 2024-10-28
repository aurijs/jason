import type Collection from "./collection";

/**
 * Base data interface that all data should extend.
 *
 * @property id A unique identifier for the item.
 * @property _version The version number of the item. Only used by the versioning concurrency strategy.
 * @property _lastModified The last modified timestamp of the item. Only used by the versioning concurrency strategy.
 */
export interface BaseDocument {
	id?: string;
	_version?: number;
	_lastModified?: number;
}

/**
 * Helper type to extract the document type from an array
 */
type ExtractDocument<T> = T extends Array<infer D> ? D : never;

/**
 * Helper type to ensure each collection value is an array of BaseDocument
 */
export type EnsureBaseDocument<T> = {
	[K in keyof T]: T[K] extends Array<BaseDocument> ? T[K] : never;
};

/**
 * Type to extract the document type from a collection
 */
export type CollectionDocument<
	T extends BaseCollections,
	K extends keyof T,
> = T[K] extends (infer D)[] ? (D extends BaseDocument ? D : never) : never;

/**
 * Base interface for collections map in JasonDB
 */
export interface BaseCollections {
	[key: string]: BaseDocument[];
}

/**
 * Represents information about a lock in a database.
 *
 * @property id The unique id of the lock.
 * @property timestamp The timestamp when the lock was acquired.
 * @property expiresAt The timestamp when the lock will expire.
 */
export interface LockInfo {
	id: string;
	timestamp: number;
	expiresAt: number;
}

/**
 * Represents a database data type.
 *
 * @template T The type of data in the database.
 */
export type DatabaseData<T> = Record<string, T>;

/**
 * Represents an index type.
 *
 * @template T The type of data in the index.
 */
export interface Index<T> {
	/**
	 * The field of the index.
	 */
	field: keyof T;
	/**
	 * The values of the index.
	 */
	values: Map<unknown, string[]>;
}

/**
 * Represents a validation function type.
 *
 * @template T The type of data being validated.
 */
export type ValidationFunction<T> = (item: T) => boolean;

/**
 * Represents a plugin type.
 *
 * @template T The type of data in the database.
 */
export type Plugin<T extends BaseDocument> = (collection: Collection<T>) => void;

/**
 * Represents a query options type.
 *
 */
export interface QueryOptions {
	/**
	 * The limit of the query.
	 */
	limit?: number;
	/**
	 * The offset of the query.
	 */
	offset?: number;
	/**
	 * The order by field of the query.
	 */
	orderBy?: string;
	/**
	 * The order of the query.
	 */
	order?: "asc" | "desc";
}

/**
 * Represents a partial query options type.
 *
 * @see QueryOptions
 */
export type QueryOptionsPartial = Partial<QueryOptions>;

/**
 * Represents the concurrency strategy of a JasonDB instance.
 *
 * The possible values are:
 * - "optimistic": The default strategy which will throw an error if the data has changed since the last read.
 * - "versioning": The strategy which will auto-increment a version number for each update and will throw an error if the version number has changed since the last read.
 * - "none": The strategy which will not check for concurrency at all.
 */
export type ConcurrencyStrategy = "optimistic" | "versioning" | "none";

/**
 * Represents metadata for a collection.
 *
 * @property name The name of the collection.
 * @property documentCount The number of documents in the collection.
 * @property indexes A list of indexes present in the collection.
 * @property lastModified The timestamp of the last modification to the collection.
 */
export interface CollectionMetadata {
	name: string;
	documentCount: number;
	indexes: string[];
	lastModified: number;
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
export interface CollectionOptions<T extends BaseDocument> {
	initialData?: T[];
	schema?: ValidationFunction<T>;
	concurrencyStrategy?: ConcurrencyStrategy;
	cacheTimeout?: number;
}
