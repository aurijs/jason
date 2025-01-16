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
bun add -D jason

# or

npm install -D jason
```

## 💻 Quick Example

```typescript
import JasonDB from "jason";

// Define your interfaces
interface User {
  name: string;
  email: string;
}

interface Database {
  users: User[];
}

// Initialize the database
const db = new JasonDB<Database>("my-db");

// Create a collection
const users = await db.collection("users", {
  schema: (user) => user.name && user.email.includes("@"),
});

// Use the simple API
await users.create({
  name: "John Smith",
  email: "john@example.com",
});
```

## 🛠️ Core API

### 📦 JasonDB

```typescript
// Create an instance
const db = new JasonDB("my-database");

// Access collections
const myCollection = db.collection("name");

// List collections
const collections = await db.listCollections();
```

### 📑 Collections

```typescript
// Create
const doc = await collection.create({ ... });

// Read
const item = await collection.read("id");

// Update
await collection.update("id", { field: "new value" });

// Delete
await collection.delete("id");

// Query
const results = await collection.query(doc => doc.age > 18);
```

## 🔐 Concurrency Strategies

Choose the strategy that best fits your needs:

- ✨ **Optimistic** (default)

  - Perfect for most use cases
  - Prevents update conflicts

- 📝 **Versioning**

  - Stricter control
  - Change tracking

- ⚡ **None**
  - Maximum performance
  - Use with caution

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

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

⭐ If this project helped you, consider giving it a star!

📫 Questions? Open an issue or get in touch!
