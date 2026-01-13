# Plan: Document & B-Tree Caching

## Phase 1: StorageManager Caching
- [ ] Task: Initialize Caching in StorageManager
    - [ ] Update `StorageManagerOptions` to include `cacheCapacity` (default: 1000).
    - [ ] Initialize `Effect.Cache` within `makeStorageManager`.
- [ ] Task: Implement Read Caching
    - [ ] Create test: `storage-manager-cache.test.ts`. Verify repeated reads do not access file system.
    - [ ] Implement: Modify `read` to utilize `Effect.Cache.get`.
- [ ] Task: Implement Cache Invalidation
    - [ ] Update test: Verify `write` updates cache and `remove` invalidates it.
    - [ ] Implement: Update `write` to set cache value and `remove` to invalidate it.
- [ ] Task: Conductor - User Manual Verification 'StorageManager Caching' (Protocol in workflow.md)

## Phase 2: B-Tree Node Caching
- [ ] Task: Initialize Caching in BTreeService
    - [ ] Update `makeBtreeService` signature to accept `cacheCapacity`.
    - [ ] Initialize `Effect.Cache` for B-Tree nodes.
- [ ] Task: Implement Node Read Caching
    - [ ] Create test: `btree-cache.test.ts`. Verify `readNode` uses cache.
    - [ ] Implement: Wrap `readNode` logic with `Effect.Cache`.
- [ ] Task: Implement Node Write Invalidation
    - [ ] Update test: Verify `writeNode` updates the cache.
    - [ ] Implement: Update `writeNode` to refresh cache entry.
- [ ] Task: Conductor - User Manual Verification 'B-Tree Node Caching' (Protocol in workflow.md)

## Phase 3: Integration & Final Polish
- [ ] Task: Integration Testing
    - [ ] Verify end-to-end behavior: Document updates reflect in index queries with caching enabled.
- [ ] Task: Cleanup & Documentation
    - [ ] Ensure all tests pass with `bun test`.
    - [ ] Verify >80% code coverage.
    - [ ] Update internal documentation if necessary.
- [ ] Task: Conductor - User Manual Verification 'Integration & Final Polish' (Protocol in workflow.md)
