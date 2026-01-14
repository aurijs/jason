# Implementation Plan - Bulk Operations API

## Phase 1: API Scaffolding & Bulk Insertion (Checkpoint: 36c9cc7)
- [x] Task: Define Batch API Interfaces
    - [x] Sub-task: Create `BatchResult` and `BatchOperations` types in `src/types/collection.ts`.
    - [x] Sub-task: Update `Collection` interface to include the `batch` namespace.
- [x] Task: Implement `collection.batch.insert` (b924a5e)
    - [x] Sub-task: Write failing test: `batch.insert` with 10 documents returns success summary.
    - [x] Sub-task: Write failing test: `batch.insert` with some invalid documents (schema violation) returns partial failure summary (Best-Effort).
    - [x] Sub-task: Implement `insert` logic in `src/core/main.ts` under the `batch` object.
    - [x] Sub-task: Verify tests pass.
- [x] Task: Optimize WAL for Batch (b924a5e)
    - [x] Sub-task: Update WAL service in `src/layers/wal.ts` to support a `logBatch` method (or handle array of operations).
    - [x] Sub-task: Refactor `batch.insert` to use a single WAL write.
- [x] Task: Conductor - User Manual Verification 'Phase 1: API Scaffolding & Bulk Insertion' (Protocol in workflow.md) (b924a5e)

## Phase 2: Bulk Deletion & Update
- [ ] Task: Implement `collection.batch.delete`
    - [ ] Sub-task: Write failing test: `batch.delete` with a filter removes multiple documents.
    - [ ] Sub-task: Implement `delete` logic in `src/core/main.ts` using the query engine to find IDs and removing them in a loop within a single lock.
    - [ ] Sub-task: Verify tests pass.
- [ ] Task: Implement `collection.batch.update`
    - [ ] Sub-task: Write failing test: `batch.update` with a filter modifies multiple documents.
    - [ ] Sub-task: Implement `update` logic in `src/core/main.ts`.
    - [ ] Sub-task: Verify tests pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Bulk Deletion & Update' (Protocol in workflow.md)

## Phase 3: Validation & Performance
- [ ] Task: Performance Benchmarking
    - [ ] Sub-task: Create a benchmark test comparing 1000 single inserts vs 1 `batch.insert`.
    - [ ] Sub-task: Ensure the performance gain is significant (>10x).
- [ ] Task: Final Quality Gate
    - [ ] Sub-task: Run `bun run lint`.
    - [ ] Sub-task: Run `bun x tsc --noEmit`.
    - [ ] Sub-task: Verify test coverage > 80% for new batch logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Validation & Performance' (Protocol in workflow.md)
