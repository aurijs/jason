# Specification: Implement Bulk Operations API

## Overview
Introduce a high-performance bulk operations API under a `batch` namespace for collections. This reduces overhead by grouping multiple operations into single WAL entries and minimizing redundant file I/O, particularly useful for data seeding and high-throughput ingestion.

## Functional Requirements
- **Namespaced API:**
    - `collection.batch.insert(docs[])`: Inserts multiple documents.
    - `collection.batch.delete(filter)`: Deletes multiple documents matching a filter.
    - `collection.batch.update(filter, updateDoc)`: Updates multiple documents matching a filter.
- **Best-Effort Execution:**
    - Bulk operations will attempt to process all items.
    - Returns a summary object: `{ success: number, failures: Array<{ index: number, error: string }> }`.
- **WAL Optimization:**
    - Group all operations within a single batch into one WAL record to minimize disk flushes.
- **Concurrency:**
    - Ensure the entire batch is processed within a single lock/permit of the collection's semaphore to maintain consistency during the bulk write.

## Acceptance Criteria
- [ ] `collection.batch.insert` is significantly faster than multiple single `insert` calls for 1000+ items.
- [ ] `collection.batch.delete` correctly targets and removes all matching documents.
- [ ] `collection.batch.update` correctly applies changes to all matching documents.
- [ ] Return values accurately reflect which operations succeeded or failed.
- [ ] WAL log contains only one entry for a batch operation.

## Out of Scope
- Cross-collection transactions.
- Interactive batch processing (pausing/resuming batches).
