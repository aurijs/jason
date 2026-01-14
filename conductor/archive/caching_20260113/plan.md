# Plan: Document & B-Tree Caching

## Phase 1: StorageManager Caching (Checkpoint: b5a6c82)
- [x] Task: Initialize Caching in StorageManager (b5a6c82)
    - [x] Update `StorageManagerOptions` to include `cacheCapacity` (default: 1000).
    - [x] Initialize `Effect.Cache` within `makeStorageManager`.
- [x] Task: Implement Read Caching (b5a6c82)
    - [x] Create test: `storage-manager-cache.test.ts`. Verify repeated reads do not access file system.
    - [x] Implement: Modify `read` to utilize `Effect.Cache.get`.
- [x] Task: Implement Cache Invalidation (b5a6c82)
    - [x] Update test: Verify `write` updates cache and `remove` invalidates it.
    - [x] Implement: Update `write` to set cache value and `remove` to invalidate it.
- [x] Task: Conductor - User Manual Verification 'StorageManager Caching' (Protocol in workflow.md) (b5a6c82)

## Phase 2: B-Tree Node Caching (Checkpoint: b5a6c82)
- [x] Task: Initialize Caching in BTreeService (b5a6c82)
    - [x] Update `makeBtreeService` signature to accept `cacheCapacity`.
    - [x] Initialize `Effect.Cache` for B-Tree nodes.
- [x] Task: Implement Node Read Caching (b5a6c82)
    - [x] Create test: `btree-cache.test.ts`. Verify `readNode` uses cache.
    - [x] Implement: Wrap `readNode` logic with `Effect.Cache`.
- [x] Task: Implement Node Write Invalidation (b5a6c82)
    - [x] Update test: Verify `writeNode` updates the cache.
    - [x] Implement: Update `writeNode` to refresh cache entry.
- [x] Task: Conductor - User Manual Verification 'B-Tree Node Caching' (Protocol in workflow.md) (b5a6c82)

## Phase 3: Integration & Final Polish (Checkpoint: b5a6c82)
- [x] Task: Integration Testing (b5a6c82)
    - [x] Verify end-to-end behavior: Document updates reflect in index queries with caching enabled.
- [x] Task: Cleanup & Documentation (b5a6c82)
    - [x] Ensure all tests pass with `bun test`.
    - [x] Verify >80% code coverage.
    - [x] Update internal documentation if necessary.
- [x] Task: Conductor - User Manual Verification 'Integration & Final Polish' (Protocol in workflow.md) (b5a6c82)