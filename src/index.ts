import { readdir } from "node:fs/promises";
import path from "node:path";
import Collection from "./collection";
import type {
	BaseDocument,
	CollectionDocument,
	CollectionOptions,
	EnsureBaseDocument,
} from "./type";

export default class JasonDB<T extends EnsureBaseDocument<T>> {
	private basePath: string;
	private collections = new Map<
		keyof T,
		Collection<CollectionDocument<T, keyof T>>
	>();

	/**
	 * Constructs a new JasonDB instance.
	 *
	 * @param basePath - The base path where the database files will be stored.
	 */
	constructor(basePath: string) {
		this.basePath = path.join(process.cwd(), `${basePath}.json`);
	}

	/**
	 * Retrieves or creates a collection in the database.
	 *
	 * If a collection with the given name does not exist, it initializes a new collection
	 * with the provided options and stores it. If the collection already exists, it returns the existing one.
	 *
	 * @param name - The name of the collection.
	 * @param options - Optional settings for the collection.
	 * @param options.initialData - An array of initial data to populate the collection.
	 * @param options.schema - A validation function for the collection's documents.
	 * @param options.concurrencyStrategy - The concurrency strategy to use for the collection.
	 * @param options.cacheTimeout - The cache timeout in milliseconds.
	 * @returns The collection instance associated with the given name.
	 */
	collection<K extends keyof T>(
		name: K,
		options: CollectionOptions<CollectionDocument<T, K>> = {},
	): Collection<CollectionDocument<T, K>> {
		const existingCollection = this.collections.get(name);

		if (existingCollection) {
			return existingCollection as Collection<CollectionDocument<T, K>>;
		}

		const newCollection = new Collection<CollectionDocument<T, K>>(
			this.basePath,
			name as string,
			options,
		);

		this.collections.set(name, newCollection);
		return newCollection;
	}

	/**
	 * Lists all collections in the database.
	 *
	 * Reads the base directory and returns the names of all subdirectories,
	 * which represent the collections.
	 *
	 * @returns A promise that resolves to an array of collection names.
	 * If an error occurs, it resolves to an empty array.
	 */
	async listCollections(): Promise<(keyof T)[]> {
		try {
			const entries = await readdir(this.basePath, { withFileTypes: true });
			return entries
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name) as (keyof T)[];
		} catch {
			return [];
		}
	}
}
