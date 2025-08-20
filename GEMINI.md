# Gemini Project Analysis: jason

## Project Overview

**jason** is a simple, lightweight, and embeddable JSON document database built on Bun. It is designed to be fast and easy to use in Bun projects, providing features like schema validation, concurrency control, and built-in caching.

## Key Features

- **Simple API:** CRUD and query JSON documents with a straightforward API.
- **Lightweight & Embeddable:** Easy to integrate into projects without adding significant overhead.
- **Schema Validation:** Ensures data integrity by validating documents against a defined schema.
- **Concurrency Control:** Prevents update conflicts.
- **Versioning Support:** Tracks document changes.
- **Built-in Caching:** Improves read performance with a configurable cache.
- **Query System:** Allows finding documents with custom criteria.

## Project Structure

The project is structured as follows:

- **`src/`**: Contains the source code of the library.
  - **`core/`**: Core classes of the library.
    - **`main.ts`**: The main `JasonDB` class.
    - **`errors.ts`**: Custom error classes.
  - **`data/`**: Data management classes.
    - **`collection.ts`**: The `Collection` class, which manages documents.
    - **`metadata.ts`**: The `Metadata` class, which manages collection metadata.
    - **`cache.ts`**: The `Cache` class for in-memory caching.
    - **`btree.ts`**: A B-tree implementation for indexing (not fully integrated).
  - **`io/`**: Input/output classes.
    - **`writer.ts`**: The `Writer` class for atomic file writes.
  - **`types/`**: TypeScript type definitions.
  - **`utils/`**: Utility functions.
- **`test/`**: Contains the tests for the library.
- **`dist/`**: The compiled output of the project.
- **`package.json`**: Project metadata and dependencies.
- **`readme.md`**: Project documentation.
- **`tsconfig.json`**: TypeScript configuration.

## Architecture

The core of the library is the `JasonDB` class, which manages a set of collections. Each collection is represented by a `Collection` class, which handles the CRUD operations for the documents in that collection.

The `Collection` class uses a `Writer` class to write data to the file system atomically. It also uses a `Cache` class to cache documents in memory for faster access.

The `Metadata` class is used to store metadata about each collection, such as the number of documents and the indexes.

The library also includes a `BTree` class for indexing, but it is not yet fully integrated with the `Collection` class.

## How to Use

To use the library, you first need to create a `JasonDB` instance:

```typescript
import JasonDB from "@aurios/jason";

const db = new JasonDB("my-db");
```

Then, you can create a collection and perform CRUD operations on it:

```typescript
const users = await db.collection("users");

await users.create({ name: "John Doe", email: "john.doe@example.com" });

const user = await users.read("some-id");

await users.update("some-id", { name: "Jane Doe" });

await users.delete("some-id");
```

## Future Improvements

- **Full B-Tree Integration:** Integrate the `BTree` class with the `Collection` class to provide efficient indexing and querying capabilities.
- **Query Language:** Implement a more powerful query language to allow for more complex queries.
- **Transactions:** Add support for transactions to ensure data consistency across multiple operations.
- **Plugins:** Implement a plugin system to allow for extending the functionality of the library.
