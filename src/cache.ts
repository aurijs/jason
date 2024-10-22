import type { BaseDocument } from "./type";

export default class Cache<T = BaseDocument> {
	#cache = new Map<string, T>();
	#cacheTimeout = 60000;

	constructor(cacheTimout = 60000) {
		this.#cacheTimeout = cacheTimout;
	}

	/**
	 * Gets the current cache timeout duration.
	 * Defaults to 60 seconds (1 minute).
	 * @returns The duration in milliseconds after which cached items are automatically removed.
	 */
	get timeout() {
		return this.#cacheTimeout;
	}

	/**
	 * Sets the cache timeout duration.
	 *
	 * @param timeout - The duration in milliseconds after which the cached item should be removed.
	 */
	set timeout(timeout: number) {
		this.#cacheTimeout = timeout;
	}

	/**
	 * Updates the cache with the given item and sets a timeout for its expiration.
	 *
	 * @param id - The unique identifier of the item to be cached.
	 * @param item - The item to be stored in the cache.
	 *
	 * The item will be automatically removed from the cache after the specified cache timeout.
	 */
	update(id: string, item: T): void {
		this.#cache.set(id, item);
		setTimeout(() => this.#cache.delete(id), this.#cacheTimeout);
	}

	/**
	 * Returns the item from the cache with the given id or null if it doesn't exist.
	 *
	 * @param id - The id of the item to be retrieved.
	 */
	get(id: string): T | null {
		return this.#cache.get(id) || null;
	}

	/**
	 * Removes the item with the specified id from the cache.
	 *
	 * @param id - The id of the item to be removed from the cache.
	 */
	delete(id: string): void {
		this.#cache.delete(id);
	}
}
