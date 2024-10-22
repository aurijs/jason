# jason

A simple, lightweight, and embeddable JSON document database built with Bun.  jason provides a straightforward API for managing collections of JSON documents, featuring built-in caching and support for schema validation and optimistic concurrency.

## Features

* **Easy to use:** Simple API for creating, reading, updating, deleting, and querying JSON documents.
* **Lightweight and embeddable:**  Designed to be easily integrated into your Bun projects without bloat.
* **Schema validation:**  Ensure data integrity with custom validation functions.
* **Concurrency control:**  Optimistic concurrency strategy prevents data corruption from conflicting updates.
* **Versioning support:**  Optional versioning helps track document changes and manage concurrent updates.
* **Built-in caching:**  Improve read performance with configurable caching.
* **Querying:** Filter documents based on custom criteria.


## Installation

```bash
bun install
```

## Usage

```typescript
import JasonDB from "jason";

interface User extends BaseDocument {
  name: string;
  email: string;
}

interface Post extends BaseDocument {
  title: string;
  content: string;
  author: string;
}

interface Collections {
  users: User[];
  posts: Post[];
}


// Initialize the database with the name "my-database"
const db = new JasonDB<Collections>("my-database");

// Access a collection (creates it if it doesn't exist)
const users = db.collection("users", {
  schema: (user) => user.name.length > 0 && user.email.includes("@"), // Example schema validation
  cacheTimeout: 60000 // optional cache timeout in ms, defaults to 60000ms
});

const posts = db.collection('posts');

// Create a new user
const newUser = await users.create({ name: "John Doe", email: "john.doe@example.com" });

// Read a user
const user = await users.read(newUser.id);

// Update a user
const updatedUser = await users.update(user.id, { name: "Jane Doe" });

// Delete a user
await users.delete(user.id);

// Create a new post
const newPost = await posts.create({ title: "My First Post", content: "Hello world!", author: "John Doe" });

// Query posts (e.g., find all posts by John Doe)
const johnDoePosts = await posts.query((post) => post.author === "John Doe");

// List all collections
const collectionNames = await db.listCollections();

```


## API

### `JasonDB`

* **`new JasonDB<T>(basePath: string)`:** Creates a new database instance.  `basePath` specifies the directory where the database files will be stored (a `.json` extension will be added). The generic type `T` defines the structure of your collections.
* **`collection<K extends keyof T>(name: K, options?: CollectionOptions<CollectionDocument<T, K>>): Collection<CollectionDocument<T, K>>`:** Gets a collection by name, creating it if it doesn't exist.  Options can include `schema`, `concurrencyStrategy`, `cacheTimeout`, and `initialData`.
* **`listCollections(): Promise<(keyof T)[]>`:**  Returns a list of all collections in the database.

### `Collection`

* **`create(data: Omit<T, "id">): Promise<T>`:** Creates a new document in the collection.
* **`read(id: string): Promise<T | null>`:** Reads a document by ID. Returns `null` if not found.
* **`update(id: string, data: Partial<Omit<T, "id">>): Promise<T | null>`:** Updates a document by ID. Returns `null` if not found.
* **`delete(id: string): Promise<boolean>`:** Deletes a document by ID.  Returns `true` on success, `false` otherwise.
* **`query(filter: (doc: T) => boolean): Promise<T[]>`:** Queries documents based on a filter function.


## Concurrency Strategies

* **`optimistic` (default):**  Throws an error if the document has been modified since it was last read.  Suitable for most use cases.
* **`versioning`:**  Uses a `_version` field to track changes and prevent conflicts.  Provides stronger consistency guarantees.
* **`none`:**  No concurrency control.  Use with caution in multi-threaded environments.

## Contributing

Contributions are welcome! Please feel free to submit bug reports, feature requests, and pull requests.

## License

MIT