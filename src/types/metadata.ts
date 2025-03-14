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
