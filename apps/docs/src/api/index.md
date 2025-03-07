# Node.js API Reference

This page documents the Node.js implementation of JasonDB. The API is designed to be intuitive and easy to use, with support for both Promise-based and async/await programming styles.

## Installation

::: code-group

```bash [npm]
npm install @aurios/jason
```

```bash [yarn]
yarn add @aurios/jason
```

```bash [pnpm]
pnpm add @aurios/jason
```

```bash [bun]
bun add @aurios/jason
```

:::
## Importing

```js
import { JasonDB } from 'node-jason';
```

Or using CommonJS:

```js
const { JasonDB } = require('node-jason');
```

## Database

### Creating a Database Instance

```js
const db = new JasonDB(path, options);
```

**Parameters:**

- `path` (string): The directory path where database files will be stored
- `options` (object, optional): Configuration options
  - `autoCreate` (boolean): Automatically create the directory if it doesn't exist (default: `true`)
  - `compression` (boolean): Enable data compression (default: `false`)
  - `serializationFormat` (string): Format for serializing data ('json' or 'bson', default: 'json')

### Database Methods

#### collection(name)

Creates or retrieves a collection.

```js
const users = db.collection('users');
```

**Parameters:**

- `name` (string): The name of the collection

**Returns:** A Collection instance

#### createCollection(name, options)

Explicitly creates a new collection with options.

```js
const users = await db.createCollection('users', {
  validator: { $jsonSchema: userSchema }
});
```

**Parameters:**

- `name` (string): The name of the collection
- `options` (object, optional): Collection configuration
  - `validator` (object): Schema validation rules
  - `validationLevel` (string): When validation is applied ('strict' or 'moderate', default: 'strict')

**Returns:** A Promise that resolves to a Collection instance

#### dropCollection(name)

Removes a collection and all its data.

```js
await db.dropCollection('users');
```

**Parameters:**

- `name` (string): The name of the collection to drop

**Returns:** A Promise that resolves to `true` if successful

#### listCollections()

Lists all collections in the database.

```js
const collections = await db.listCollections();
console.log(collections); // ['users', 'products', ...]
```

**Returns:** A Promise that resolves to an array of collection names

#### startSession()

Starts a new session for transactions.

```js
const session = await db.startSession();
```

**Returns:** A Promise that resolves to a Session instance

#### backup(path)

Creates a backup of the database.

```js
await db.backup('./backups/mydb_backup');
```

**Parameters:**

- `path` (string): The directory path where the backup will be stored

**Returns:** A Promise that resolves when the backup is complete

#### close()

Closes the database connection and releases resources.

```js
await db.close();
```

**Returns:** A Promise that resolves when the database is closed
