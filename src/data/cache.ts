import { derived, effect, state } from "../reactive/index.js";
import type { BaseDocument } from "../types/index.js";

interface CacheState<T> {
	items?: Map<string, T>;
	timestamps?: Map<string, number>;
	timeout: number;
}

export default class Cache<T = BaseDocument> {
	#state = state<CacheState<T>>({
		items: new Map(),
		timestamps: new Map(),
		timeout: 60000,
	});

	constructor(cacheTimeout = 60000) {
		this.#state.timeout = cacheTimeout;

		effect(() => {
			const now = Date.now();
			const timeout = this.#state.timeout;

			if (this.#state.timestamps) {
				for (const [key, timestamp] of this.#state.timestamps) {
					if (now - timestamp > timeout) {
						this.delete(key);
					}
				}
			}
		});
	}

	/**
	 * Gets the current cache timeout duration.
	 * Defaults to 60 seconds (1 minute).
	 * @returns The duration in milliseconds after which cached items are automatically removed.
	 */
	get timeout() {
		return this.#state.timeout;
	}

	/**
	 * Sets the cache timeout duration.
	 *
	 * @param timeout - The duration in milliseconds after which the cached item should be removed.
	 */
	set timeout(timeout: number) {
		this.#state.timeout = timeout;
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
		this.#state.items?.set(id, item);
		this.#state.timestamps?.set(id, Date.now());
		setTimeout(() => this.delete(id), this.#state.timeout);
	}

	/**
	 * Returns the item from the cache with the given id or null if it doesn't exist.
	 *
	 * @param id - The id of the item to be retrieved.
	 */
	get(id: string): T | null {
		return this.#state.items?.get(id) ?? null;
	}

	/**
	 * Removes the item with the specified id from the cache.
	 *
	 * @param id - The id of the item to be removed from the cache.
	 */
	delete(id: string): void {
		this.#state.items?.delete(id);
		this.#state.timestamps?.delete(id);
	}
}
