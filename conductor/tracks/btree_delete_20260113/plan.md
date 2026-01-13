# Implementation Plan - B-Tree Deletion

## Phase 1: Test Infrastructure & Basic Scenarios
- [x] Task: Create Tree Validation Helper f98c052
    - [x] Sub-task: Implement a `validateTree` function in `test/btree.test.ts` to verify B-Tree properties (sorted keys, correct child counts, depth consistency).
- [x] Task: Implement Basic Leaf Deletion 487b6f2
    - [x] Sub-task: Write failing test: Delete non-existent key returns `false`.
    - [x] Sub-task: Write failing test: Delete existing key from a leaf node (no rebalancing needed).
    - [x] Sub-task: Implement `delete` method shell and basic leaf deletion logic in `src/make/btree.ts`.
    - [x] Sub-task: Verify tests pass.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Test Infrastructure & Basic Scenarios' (Protocol in workflow.md) 36861ac

## Phase 2: Complex Deletion & Rebalancing
- [ ] Task: Implement Internal Node Deletion
    - [ ] Sub-task: Write failing test: Delete key from internal node (requires replacing with predecessor/successor).
    - [ ] Sub-task: Implement logic to swap with predecessor/successor and delete from child.
    - [ ] Sub-task: Verify tests pass.
- [ ] Task: Implement Rebalancing (Borrow & Merge)
    - [ ] Sub-task: Write failing test: Delete causing underflow (requires borrowing from sibling).
    - [ ] Sub-task: Write failing test: Delete causing underflow (requires merging with sibling).
    - [ ] Sub-task: Write failing test: Delete causing root height reduction.
    - [ ] Sub-task: Implement `rebalance` logic (borrowLeft, borrowRight, merge).
    - [ ] Sub-task: Verify tests pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Complex Deletion & Rebalancing' (Protocol in workflow.md)

## Phase 3: Reliability & Cleanup
- [ ] Task: Property-Based Testing
    - [ ] Sub-task: Implement a randomized test loop in `test/btree.test.ts` (random inserts followed by random deletes) and validate tree structure after every step.
- [ ] Task: Code Quality & Final Review
    - [ ] Sub-task: Run `bun run lint` and fix issues.
    - [ ] Sub-task: Run `bun x tsc --noEmit` to ensure type safety.
    - [ ] Sub-task: Verify test coverage > 80%.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Reliability & Cleanup' (Protocol in workflow.md)
