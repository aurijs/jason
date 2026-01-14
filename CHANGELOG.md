# @aurios/jason

## 2.0.0

### Major Changes

- Implemented high-performance Bulk Operations API (batch.insert|update|delete) with WAL optmization. Added in-memory LRU caching for documents and B-Tree nodes to significantly improve read performance. Added support for flexible schema validation using any standard schema compliant library like Zod, Valibot or Effect.Schema.

  What's Changed & What's Different:
  1.  Bulk Operations API:
      - New: batch.insert, batch.update, and batch.delete methods.
      - Difference: Previously, operations were single-document. Now you can
        process large sets of data much faster with Write-Ahead Logging (WAL)
        optimization ensuring data integrity and speed.
  2.  Performance Improvements (Caching):
      - New: In-memory LRU (Least Recently Used) caching for both documents and
        B-Tree nodes.
      - Difference: Read operations are significantly faster as frequently
        accessed data is served from memory instead of hitting the disk every
        time.
  3.  Flexible Schema Validation:
      - New: Support for @standard-schema/spec.
      - Difference: You are no longer tied to a specific validation logic. You can
        plug in popular libraries like Zod or Valibot to define and enforce your
        data schemas.
