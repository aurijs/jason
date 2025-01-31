import type { BaseDocument } from "../types/index.js";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export default class Cache<T = BaseDocument> {
  #data = new Map<string, CacheEntry<T>>();
  #queue: string[] = [];
  #timeout = 60000;
  #maxSize: number;
  #cleanupTimer: NodeJS.Timeout | Timer;

  constructor(cacheTimout = 60_000, maxSize = 1000) {
    this.#timeout = cacheTimout;
    this.#maxSize = maxSize;
    this.#cleanupTimer = setInterval(
      () => this.#cleanup(),
      Math.min(30_000, this.#timeout)
    );
  }

  /**
   * Gets the current cache timeout duration.
   * Defaults to 60 seconds (1 minute).
   * @returns The duration in milliseconds after which cached items are automatically removed.
   */
  get timeout() {
    return this.#timeout;
  }

  /**
   * Sets the cache timeout duration.
   *
   * @param timeout - The duration in milliseconds after which the cached item should be removed.
   */
  set timeout(timeout: number) {
    this.#timeout = timeout;
  }

  /**
   * Updates the cache with the given id and value.
   *
   * If the cache has reached its maximum size, it will remove 10% of the items
   * in the cache before adding the new item.
   *
   * @param id - The id of the item to be updated.
   * @param value - The value of the item to be updated.
   */
  update(id: string, value: T): void {
    if (this.#data.has(id)) {
      this.#refresh(id);
    } else {
      if (this.#data.size >= this.#maxSize) {
        this.#evict(Math.floor(this.#maxSize * 0.1));
      }
      this.#data.set(id, { value, timestamp: this.#getNow() });
      this.#queue.push(id);
    }
  }

  /**
   * Retrieves an item from the cache by its id.
   *
   * If the item is not found or has exceeded the cache timeout, it returns null.
   * Otherwise, it returns the cached value.
   *
   * @param id - The id of the item to retrieve from the cache.
   * @returns The cached value, or null if not found or expired.
   */
  get(id: string) {
    const entry = this.#data.get(id);
    if (!entry) return null;

    const now = this.#getNow();
    if (now - entry.timestamp > this.#timeout) {
      this.#data.delete(id);
      return null;
    }

    this.#refresh(id);
    return entry.value;
  }

  /**
   * Removes the item with the specified id from the cache.
   *
   * @param id - The id of the item to be removed from the cache.
   */
  delete(id: string): void {
    this.#data.delete(id);
  }

  /**
   * Destroys the cache by stopping the automatic cleanup interval.
   *
   * Use this method when you are finished with the cache.
   */
  destroy() {
    clearInterval(this.#cleanupTimer);
  }

  #refresh(id: string) {
    const idx = this.#queue.indexOf(id);
    if (idx > -1) {
      this.#queue.splice(idx, 1);
    }

    this.#queue.push(id);
  }

  #evict(count: number) {
    const victims = this.#queue.splice(0, count);
    for (const id of victims) {
      this.#data.delete(id);
    }
  }

  #cleanup() {
    const now = this.#getNow();
    const threshold = now - this.#timeout;

    for (const [id, entry] of this.#data) {
      if (entry.timestamp < threshold) {
        this.#data.delete(id);
      }
    }
  }

  #getNow = Date.now.bind(Date);
}
