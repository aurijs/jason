# jason db 📦

![image with logo and name of package](./static/markdown-image.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/mit-license.php)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/your/repo/graphs/commit-activity)
[![Made with Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
![Node Current](https://img.shields.io/node/v/%40aurios%2Fjason?style=flat&logo=node.js&labelColor=000)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40aurios%2Fjason?style=flat)
![NPM Downloads](https://img.shields.io/npm/dw/%40aurios%2Fjason?style=flat&logo=npm)
![GitHub Repo stars](https://img.shields.io/github/stars/realfakenerd/jason)

> 🚀 A simple, lightweight, and embeddable JSON database built with Bun

jason is the perfect solution when you need a fast and easy-to-use JSON database in your Bun projects. With features like schema validation, concurrency control, and built-in caching, it provides everything you need in a simple package.

## ✨ Highlights

- 📝 **Simple API** - CRUD and query JSON documents with just a few lines of code
- 🪶 **Lightweight & Embeddable** - Easy integration without adding bloat to your project
- ✅ **Schema Validation** - Ensure your data integrity
- 🔒 **Concurrency Control** - Prevent update conflicts
- 📚 **Versioning Support** - Track document changes
- ⚡ **Built-in Caching** - Improve read performance
- 🔍 **Query System** - Find documents with custom criteria

## 🚀 Installation

```sh
bun add @aurios/jason

# or

npm i @aurios/jason
```

## 💻 Quick Example

```typescript
import { createJasonDB, gte } from "@aurios/jason";

// Initialize the database
const db = await createJasonDB({
  base_path: "./my-db",
  collections: {
    // Define schema using the simple string syntax
    users: "name;email;age:number;isActive:boolean"
  }
});

const { users } = db.collections;

// Create a document
await users.create({
  name: "John Smith",
  email: "john@example.com",
  age: 30,
  isActive: true
});

// Find documents using helper functions
const adults = await users.find({
  where: { 
    age: gte(18) 
  }
});
```

## 🛠️ Core API

### 📦 Initialization

Use `createJasonDB` to initialize your database instance. You define your collections and their schemas in the configuration.

```typescript
const db = await createJasonDB({
  base_path: "./data", // Directory to store data
  collections: {
    // String syntax: "field1;field2:type;..."
    posts: "@id;title;content;published:boolean;*tags",
    // You can also use Effect Schema objects if preferred
    // users: Schema.Struct({ ... })
  }
});
```

### 📝 Schema String Syntax

The string syntax provides a shorthand for defining fields and indexes:

*   **Format**: `name:type` (type defaults to string if omitted)
*   **Types**: `string`, `number`, `boolean`, `date`, `array<T>`, `record<K,V>`
*   **Modifiers**:
    *   `@id`: UUID Primary Key
    *   `++id`: Auto-increment Primary Key
    *   `&name`: Unique Index
    *   `*tags`: Multi-entry Index (for arrays)
    *   `[a+b]`: Compound Index

### 📑 Collection Operations

Access collections via `db.collections.<name>`.

```typescript
const collection = db.collections.posts;

// Create
const post = await collection.create({ 
  title: "Hello World", 
  tags: ["news", "tech"] 
});

// Read (by ID)
const item = await collection.findById(post.id);

// Update
await collection.update(post.id, { title: "Updated Title" });

// Delete
await collection.delete(post.id);

// Check existence
const exists = await collection.has(post.id);
```

### 🔍 Querying

JasonDB provides a rich set of query helpers for filtering data.

```typescript
import { gt, startsWith, and, or } from "@aurios/jason";

// Simple equality
const results = await collection.find({
  where: { published: true }
});

// Comparison operators
const recent = await collection.find({
  where: { 
    views: gt(100),
    title: startsWith("How to")
  },
  order_by: { field: "createdAt", order: "desc" },
  limit: 10
});

// Logical operators
const complex = await collection.find({
  where: or(
      { category: "tech" },
      { views: gt(1000) }
  )
});
```

### 📦 Batch Operations

Perform bulk actions efficiently using the `batch` API.

```typescript
// Batch Insert
await collection.batch.insert([
  { name: "Doc 1", value: 10 },
  { name: "Doc 2", value: 20 },
  { name: "Doc 3", value: 30 }
]);

// Batch Update
// Updates all documents where category is "old_tech"
await collection.batch.update(
  { category: "old_tech" }, // Filter
  { category: "retro_tech", active: false } // Update data
);

// Batch Delete
// Deletes all archived documents
await collection.batch.delete({ 
  archived: true 
});
```

## 🤝 Contributing

Contributions are welcome!

1. 🍴 Fork the project
2. 🔧 Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. 📝 Commit your changes (`git commit -m 'Add: amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/AmazingFeature`)
5. 🔍 Open a Pull Request

## 🛠 Development

```sh
# Clone the repo
git clone https://github.com/realfakenerd/jason

# Install dependencies 
bun install

# Run tests
bun test

# Build project
bun run build

```

## 📄 License

Distributed under the [MIT License](../LICENSE)

---

⭐ If this project helped you, consider giving it a star!
📫 Questions? Open an issue or get in touch!
