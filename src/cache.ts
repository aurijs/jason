import type { DatabaseData } from "./type";

export default class Cache<T> {
	#cache = new Map<string, DatabaseData<T>>();
	#cacheTimeout = 60000;

	/**
	 * Updates the cache with the given item and sets a timeout to remove it.
	 *
	 * @param item - The item to be cached, identified by its unique id.
	 */
	updateCache(item: T): void {
		this.#cache.set(item.id, item);
		setTimeout(() => this.#cache.delete(item.id), this.#cacheTimeout);
	}

	/**
	 * Returns the item from the cache with the given id or null if it doesn't exist.
	 *
	 * @param id - The id of the item to be retrieved.
	 */
	getFromCache(id: string): DatabaseData<T> | null {
		return this.#cache.get(id) || null;
	}

	/**
	 * Removes the item with the specified id from the cache.
	 *
	 * @param id - The id of the item to be removed from the cache.
	 */
	removeFromCache(id: string): void {
		this.#cache.delete(id);
	}

	/**
	 * Sets the cache timeout duration.
	 *
	 * @param timeout - The duration in milliseconds after which the cached item should be removed.
	 */
	setCacheTimeout(timeout: number): void {
		this.#cacheTimeout = timeout;
	}
}
