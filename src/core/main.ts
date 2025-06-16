import { access, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import Collection from "../data/collection.js";
import type {
  CollectionOptions,
  Document,
  JasonDBOptions,
} from "../types/index.js";

export default class JasonDB<T> {
  #basePath: string;
  #collections = new Map<keyof T, Collection<T, keyof T>>();

  /**
   * Creates a new JasonDB instance with the given configuration.
   * @param options - Either a string representing the database name (will be created in current working directory),
   *                 or a JasonDBOptions configuration object
   * @example
   * // Simple usage
   * const db = new JasonDB('my-database');
   * 
   * // Advanced usage
   * const db = new JasonDB({
   *   basename: 'my-database',
   *   path: './custom-location'
   * });
   */
  constructor(options: string | JasonDBOptions) {
    if (typeof options === "string") {
      const cwd = path.resolve(".");
      this.#basePath = path.join(cwd, options);
    } else {
		const cwd = path.resolve(options.path);
    this.#basePath = path.join(cwd, options.basename);
	}

    this.#ensureDataDirExists();
  }

  async #ensureDataDirExists() {
    try {
      await access(this.#basePath);
    } catch {
      await mkdir(this.#basePath, { recursive: true });
    }
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
   * @param options.generateMetadata - Whether to generate metadata for the collection.
   * @param options.indices - An optional string of index definitions for the collection (e.g., ['++id', '&email', '*tags']).
   * @returns The collection instance associated with the given name.
   */
  collection<K extends keyof T>(
    name: K,
    options: CollectionOptions<Document<T, K>> = {}
  ): Collection<T, K> {
    const existingCollection = this.#collections.get(name);

    if (existingCollection) {
      return existingCollection as Collection<T, K>;
    }

    const newCollection = new Collection<T, K>(this.#basePath, name, options);

    this.#collections.set(name, newCollection);

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
      if (this.#collections.size > 0)
        return Array.from(this.#collections.keys());

      const entries = await readdir(this.#basePath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
        .map((entry) => entry.name) as (keyof T)[];
    } catch (error) {
      console.error("Failed to list collections", {
        path: this.#basePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return [];
    }
  }
}
