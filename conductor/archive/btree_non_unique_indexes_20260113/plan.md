# Implementation Plan - B-Tree Non-Unique Indexes

## Phase 1: Multi-Value Retrieval
- [x] Task: Confirm Duplicate Insertion Behavior
    - [x] Sub-task: Write failing tests confirming that multiple `insert` calls with the same key successfully store all values.
    - [x] Sub-task: Verify that current `find` returns only the first match.
- [x] Task: Implement `findAll`
    - [x] Sub-task: Write failing tests for `findAll(key)` retrieving all associated values for both leaf and internal node matches.
    - [x] Sub-task: Implement `findAll` recursive search logic in `src/make/btree.ts`.
    - [x] Sub-task: Verify all search tests pass.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Multi-Value Retrieval' (Protocol in workflow.md)

## Phase 2: Precise Deletion
- [x] Task: Update Delete Signature and Logic
    - [x] Sub-task: Update the `delete` method signature in `src/make/btree.ts` to accept an optional `value: string`.
    - [x] Sub-task: Write failing tests for `delete(key, value)` where only the specific pair is removed.
    - [x] Sub-task: Write failing tests for `delete(key)` (no value) where only the first match is removed.
    - [x] Sub-task: Implement targeted removal logic in the deletion algorithm.
    - [x] Sub-task: Verify deletion and rebalancing still work correctly with duplicate keys.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Precise Deletion' (Protocol in workflow.md)

## Phase 3: Validation & Quality
- [x] Task: Stress Testing & Edge Cases 64d90cc
    - [x] Sub-task: Write tests for keys with a large number of duplicates (exceeding node order).
    - [x] Sub-task: Add property-based tests for insertion/deletion of duplicate keys.
- [x] Task: Final Quality Gate 64d90cc
    - [x] Sub-task: Run `bun run lint`.
    - [x] Sub-task: Run `bun x tsc --noEmit`.
    - [x] Sub-task: Verify test coverage > 80%.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Validation & Quality' (Protocol in workflow.md) 64d90cc
