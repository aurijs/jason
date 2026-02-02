# Specification: Implement B-Tree Delete Method

## Overview
Implement a robust `delete` method for the B-Tree service in `src/make/btree.ts`. This method will physically remove keys while maintaining the B-Tree's structural invariants through full rebalancing.

## Functional Requirements
- **Standard B-Tree Deletion:** Implement the standard B-Tree deletion algorithm, including:
    - Deleting from leaf nodes.
    - Deleting from internal nodes (finding predecessors/successors).
    - Handling underfull nodes by borrowing from siblings or merging nodes.
    - Shrinking the tree height when the root becomes empty.
- **Return Status:** The `delete` method must return an `Effect` that resolves to a `boolean`:
    - `true`: The key was found and successfully removed.
    - `false`: The key was not found in the tree.
- **Concurrency Safety:** The operation must be wrapped in the existing semaphore to ensure atomic tree modifications.
- **Type Safety:** Maintain generic key support using the provided `key_schema`.

## Non-Functional Requirements
- **Performance:** Ensure rebalancing logic minimizes disk I/O by only writing affected nodes.
- **Reliability:** Use Effect's error handling for I/O and decoding errors.

## Acceptance Criteria
- [ ] Calling `delete(key)` on a tree containing the key removes it and returns `true`.
- [ ] Calling `delete(key)` on a tree *not* containing the key returns `false`.
- [ ] The tree remains balanced and sorted after multiple deletions in various scenarios (leaf removal, merging, borrowing).
- [ ] Tree invariants (order, height, node occupancy) are preserved after every operation.
- [ ] Unit tests cover all rebalancing edge cases.

## Out of Scope
- Automated compaction of marked-deleted nodes (since we are doing physical deletion).
- Range deletions.
