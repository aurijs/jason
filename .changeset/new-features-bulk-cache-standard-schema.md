---
"@aurios/jason": minor
---

Implemented high-performance Bulk Operations API (batch.insert, batch.update, batch.delete) with WAL optimization. Added in-memory LRU caching for documents and B-Tree nodes to significantly improve read performance. Added support for flexible schema validation using any @standard-schema/spec compliant library like Zod or Valibot.
