# Specification: B-Tree Support for Non-Unique Indexes

## Overview
Refactor the B-Tree implementation to support non-unique indexes by allowing duplicate keys. This enables scenarios where multiple records share the same index key (e.g., searching for all users with the same "last_name").

## Functional Requirements
- **Duplicate Key Storage:** Modify B-Tree insertion and node structure logic to allow multiple instances of the same key, each associated with a unique value.
- **Search Capabilities:**
    - `find(key)`: Retain existing behavior, returning the first value associated with the key (or `undefined`).
    - `findAll(key)`: Add a new method that returns an `Array<string>` containing all values associated with the key.
- **Enhanced Deletion:**
    - Update `delete(key, value?)`:
        - If `value` is provided, remove only the specific key-value pair.
        - If `value` is omitted, remove the first occurrence of the key.
        - Return `true` if a removal occurred, `false` otherwise.
- **Type Integrity:** Ensure generic key support and Effect-based error handling are preserved.

## Acceptance Criteria
- [ ] Multiple calls to `insert(key, value)` with the same key succeed.
- [ ] `find(key)` returns the value of the first matching key found.
- [ ] `findAll(key)` returns all values for a given key in an array.
- [ ] `delete(key, "specific_value")` only removes that specific pair; other duplicates for that key remain.
- [ ] `delete(key)` (no value) removes exactly one instance of the key.
- [ ] B-Tree rebalancing (merging/borrowing) works correctly with duplicate keys.

## Out of Scope
- Automatic unique constraint enforcement (this track is specifically for enabling non-unique indexes).
- Range queries (to be handled in a separate track).
