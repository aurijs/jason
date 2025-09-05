import { Context, Duration, Effect, Layer, Option } from "effect";
import type { BaseDocument } from "../types/index.js";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  frequency?: number; // Para LFU
}

export type EvictionStrategy = "lru" | "lfu";

interface CacheConfig {
  cache_timeout: Duration.Duration;
  mas_size: number;
  eviction_strategy: EvictionStrategy;
}

export default class Cache<T = BaseDocument> {
  #data = new Map<string, CacheEntry<T>>();
  #queue: string[] = []; // Usado para LRU
  #timeout = 60000;
  #maxSize: number;
  #cleanupTimer: NodeJS.Timeout | Timer;
  #evictionStrategy: EvictionStrategy;

  constructor(
    cacheTimeout = 60_000,
    maxSize = 1000,
    evictionStrategy: EvictionStrategy = "lru" // Padrão para LRU
  ) {
    this.#timeout = cacheTimeout;
    this.#maxSize = maxSize;
    this.#evictionStrategy = evictionStrategy;

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
    const now = this.#getNow();
    let entry = this.#data.get(id);

    if (entry) {
      // Item existe
      entry.value = value;
      entry.timestamp = now;
      this.#refresh(id, entry); // Passa a entrada para LFU
    } else {
      // Novo item
      if (this.#data.size >= this.#maxSize) {
        // Evict antes de adicionar para criar espaço, garantindo que pelo menos 1 seja removido se maxSize >= 1
        this.#evict(Math.max(1, Math.floor(this.#maxSize * 0.1)));
      }

      // Adiciona somente se houver espaço ou se maxSize for 0 (ilimitado)
      if (this.#data.size < this.#maxSize || this.#maxSize === 0) {
        const newEntry: CacheEntry<T> = { value, timestamp: now };
        if (this.#evictionStrategy === "lfu") {
          newEntry.frequency = 1;
        }
        this.#data.set(id, newEntry);
        if (this.#evictionStrategy === "lru") {
          this.#queue.push(id); // Adiciona à fila LRU apenas se for um novo item
        }
      } else {
        // O cache está cheio e não foi possível liberar espaço.
        // Isso pode acontecer se maxSize for muito pequeno e a lógica de evicção falhar.
        console.warn(
          `Cache está cheio (maxSize: ${
            this.#maxSize
          }), não foi possível adicionar o item '${id}'.`
        );
      }
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
      this.delete(id); // Usa delete para também lidar com a fila
      return null;
    }

    this.#refresh(id, entry); // Passa a entrada para LFU
    return entry.value;
  }

  /**
   * Removes the item with the specified id from the cache.
   *
   * @param id - The id of the item to be removed from the cache.
   */
  delete(id: string): void {
    const existed = this.#data.delete(id);
    if (existed && this.#evictionStrategy === "lru") {
      // Só modifica a fila se for LRU e o item existia
      const idx = this.#queue.indexOf(id);
      if (idx > -1) {
        this.#queue.splice(idx, 1);
      }
    }
  }

  /**
   * Destroys the cache by stopping the automatic cleanup interval.
   *
   * Use this method when you are finished with the cache.
   */
  destroy() {
    clearInterval(this.#cleanupTimer);
  }

  #refresh(id: string, entry: CacheEntry<T>): void {
    if (this.#evictionStrategy === "lru") {
      const idx = this.#queue.indexOf(id);
      if (idx > -1) {
        this.#queue.splice(idx, 1);
      }
      this.#queue.push(id);
    } else if (this.#evictionStrategy === "lfu") {
      entry.frequency = (entry.frequency || 0) + 1;
    }
  }

  #evict(count: number) {
    if (count <= 0 || this.#data.size === 0) return;

    let victims: string[];

    if (this.#evictionStrategy === "lru") {
      const numToEvict = Math.min(count, this.#queue.length);
      victims = this.#queue.splice(0, numToEvict);
      for (const id of victims) {
        this.#data.delete(id); // Apenas remove do #data, #queue já foi tratada
      }
    } else {
      // LFU
      // LFU simples: ordena todos os itens por frequência (e timestamp como desempate).
      // Isso não é o mais performático para caches grandes; uma min-heap seria melhor.
      const sortedByFrequency = Array.from(this.#data.entries()).sort(
        ([, entryA], [, entryB]) => {
          const freqA = entryA.frequency || 0;
          const freqB = entryB.frequency || 0;
          if (freqA !== freqB) {
            return freqA - freqB;
          }
          return entryA.timestamp - entryB.timestamp; // Mais antigo se mesma frequência
        }
      );

      const numToEvict = Math.min(count, sortedByFrequency.length);
      victims = sortedByFrequency.slice(0, numToEvict).map(([id]) => id);
      for (const id of victims) {
        this.#data.delete(id); // Para LFU, a #queue não é usada para evicção primária
      }
    }
  }

  #cleanup() {
    const now = this.#getNow();
    const threshold = now - this.#timeout;

    // Itera sobre uma cópia das chaves para evitar problemas de modificação durante a iteração
    const currentKeys = Array.from(this.#data.keys());

    for (const id of currentKeys) {
      const entry = this.#data.get(id);
      // Verifica se a entrada ainda existe, pois pode ter sido deletada por outra operação
      if (entry && entry.timestamp < threshold) {
        this.delete(id); // Usa o método delete da classe
      }
    }
  }

  /**
   * Invalida entradas do cache com base em um predicado.
   * @param predicate Uma função que recebe o valor do cache e seu id, e retorna true se a entrada deve ser invalidada.
   * @returns O número de itens invalidados.
   */
  public invalidateWhere(predicate: (value: T, id: string) => boolean): number {
    let invalidatedCount = 0;
    const idsToInvalidate: string[] = [];

    for (const [id, entry] of this.#data) {
      if (predicate(entry.value, id)) {
        idsToInvalidate.push(id);
      }
    }

    for (const id of idsToInvalidate) {
      this.delete(id); // Usa o método delete existente para lidar com #data e #queue
      invalidatedCount++;
    }
    return invalidatedCount;
  }

  #getNow = Date.now.bind(Date);
}

interface ICache<K, V = BaseDocument> {
  readonly get: (key: K) => Effect.Effect<never, never>;
  readonly set: (key: K, value: V) => Effect.Effect<never, never>;
  readonly invalidate: (key: K) => Effect.Effect<never, never>;
  readonly invalidateWhere: (
    predicate: (value: V, key: K) => boolean
  ) => Effect.Effect<never, never>;
}

export const CacheService = <K, V = BaseDocument>() =>
  Context.Tag("CacheService")<typeof CacheService, ICache<K, V>>();

export const CacheLive = <K, V = BaseDocument>(options: CacheConfig) => Layer.scoped(
  CacheService<K, V>,

);


