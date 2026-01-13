# Specification: Document & B-Tree Caching

## Overview
Implement an in-memory caching layer for JasonDB to reduce disk I/O and improve performance for frequently accessed data. This involves caching both documents at the `StorageManager` level and index nodes at the `BTree` level.

## Functional Requirements
- **LRU Caching Strategy:** Implement Least Recently Used (LRU) eviction policy using `Effect.Cache`.
- **Configurable Capacity:** Allow users to specify the maximum number of items to cache via configuration options.
- **StorageManager Caching:**
  - Cache results of `StorageManager.read(id)`.
  - Invalidate or update the cache entry on `write(id, doc)` and `remove(id)`.
- **B-Tree Node Caching:**
  - Cache results of `BTree.readNode(id)`.
  - Invalidate or update the cache entry on `writeNode(node)`.
- **Per-Instance Scoping:** Each collection and B-Tree index will have its own dedicated cache instance.

## Non-Functional Requirements
- **Performance:** Reduce latency for read operations by serving frequently accessed items from memory.
- **Consistency:** Ensure the cache is always consistent with the underlying file system state.
- **Idiomatic Implementation:** Leverage `Effect.Cache` for robust concurrency control and integration with the existing Effect-based architecture.

## Acceptance Criteria
- [ ] Repeated calls to `read` or `readNode` for the same ID return the cached value without accessing the file system.
- [ ] Updating or deleting a document/node correctly reflects in subsequent reads (cache is updated or invalidated).
- [ ] The cache respects the configured capacity, evicting items according to the LRU policy.
- [ ] Unit tests verify that caching is active and invalidation logic works as expected.

## Out of Scope
- Global cache management across multiple collections/indices.
- Caching of `readAll` or query results (focus is on point-reads).
- Persistent cache (cache state is lost on process restart).
