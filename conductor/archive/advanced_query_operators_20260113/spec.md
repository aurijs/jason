# Specification: Implement Advanced Query Operators

## Overview
Expand the database query engine beyond simple equality checks. This track introduces a rich set of comparison, set, string, and logical operators, leveraging B-Tree range capabilities for optimized performance on indexed fields.

## Functional Requirements
- **Operator Expression DSL:**
    - Implement helper functions: `gt`, `gte`, `lt`, `lte`, `ne`, `in`, `nin`, `startsWith`, `regex`.
    - Update the `Filter<Doc>` type to support these expressions: `where({ age: gt(18) })`.
- **B-Tree Range Search:**
    - Implement `findRange` in `src/make/btree.ts`.
    - Returns an `Effect.Stream` yielding all key-value pairs within a specified range (e.g., `[start, end]`, `(start, end]`, etc.).
- **Query Engine Refactor (`src/make/query.ts`):**
    - Logic to detect if an operator can be optimized via an index.
    - Delegation to `BTree.findRange` for indexed comparison operators.
    - Fallback to collection-wide scanning and manual filtering for non-indexed fields or complex operators (e.g., `regex`).
- **Logical Operators:**
    - Support `and(...)`, `or(...)`, and `not(...)` to compose complex filters.

## Acceptance Criteria
- [ ] Queries using `gt`, `lt`, `gte`, `lte` on indexed fields use the B-Tree range search (no full scan).
- [ ] String operators like `startsWith` work correctly.
- [ ] Set operators like `in` and `nin` work correctly.
- [ ] Logical operators (`and`, `or`, `not`) correctly combine filter results.
- [ ] `findRange` in B-Tree is memory-efficient using Streams.

## Out of Scope
- Full-text search indexing.
- Joins between collections.
- Geo-spatial operators.
