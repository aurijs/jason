# Implementation Plan - Advanced Query Operators

## Phase 1: Query DSL & Types
- [x] Task: Define Operator Types
    - [x] Sub-task: Create `Operator` types and helper functions (`gt`, `lt`, etc.) in `src/types/query.ts` (new file).
    - [x] Sub-task: Update `Filter<T>` in `src/types/collection.ts` to accept `{ field: Operator<T> }`.
    - [x] Sub-task: Write unit tests ensuring the types compile correctly for various query shapes.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Query DSL & Types' (Protocol in workflow.md)

## Phase 2: B-Tree Range Support
- [x] Task: Implement Range Iterator
    - [x] Sub-task: Write failing test: `findRange` returns correct keys between bounds.
    - [x] Sub-task: Write failing test: `findRange` respects exclusive/inclusive bounds.
    - [x] Sub-task: Implement `findRange` in `src/make/btree.ts` using `Effect.Stream` or a Generator.
    - [x] Sub-task: Verify tests pass.
- [x] Task: Conductor - User Manual Verification 'Phase 2: B-Tree Range Support' (Protocol in workflow.md)

## Phase 3: Query Engine Execution
- [x] Task: Operator Evaluation Logic
    - [x] Sub-task: Implement a `matches(doc, filter)` function in `src/make/query.ts` that evaluates a document against a complex filter object (in-memory evaluation).
    - [x] Sub-task: Write comprehensive tests for all operators (`gt`, `in`, `regex`, `and`, `or`) using in-memory mock data.
- [x] Task: Index Optimization Strategy
    - [x] Sub-task: Implement logic in `src/make/collection.ts` (or `query.ts`) to analyze a query and decide:
        - Use B-Tree `findRange` (for indexed `gt`/`lt`).
        - Use B-Tree `find` (for indexed `eq`).
        - Fallback to Storage scan.
    - [x] Sub-task: Wire up the B-Tree range search to the collection query pipeline.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Query Engine Execution' (Protocol in workflow.md)

## Phase 4: Integration & Quality
- [x] Task: Integration Tests
    - [x] Sub-task: Write end-to-end tests: Insert data -> Query with operators -> Verify results.
    - [x] Sub-task: Performance verify: Ensure indexed range queries are faster than scans (optional benchmark).
- [x] Task: Final Quality Gate
    - [x] Sub-task: Lint, Type Check, Coverage > 80%.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Integration & Quality' (Protocol in workflow.md)
