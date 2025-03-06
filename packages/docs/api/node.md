# Node.js API Reference

This page documents the Node.js implementation of JasonDB. The API is designed to be intuitive and easy to use, with support for both Promise-based and async/await programming styles.

## Installation

```bash
npm install node-jason
```

Or using Yarn:

```bash
yarn add node-jason
```

## Importing

```javascript
import { JasonDB } from 'node-jason';
```

Or using CommonJS:

```javascript
const { JasonDB } = require('node-jason');
```

## Database

### Creating a Database Instance

```javascript
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

```javascript
const users = db.collection('users');
```

**Parameters:**

- `name` (string): The name of the collection

**Returns:** A Collection instance

#### createCollection(name, options)

Explicitly creates a new collection with options.

```javascript
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

```javascript
await db.dropCollection('users');
```

**Parameters:**

- `name` (string): The name of the collection to drop

**Returns:** A Promise that resolves to `true` if successful

#### listCollections()

Lists all collections in the database.

```javascript
const collections = await db.listCollections();
console.log(collections); // ['users', 'products', ...]
```

**Returns:** A Promise that resolves to an array of collection names

#### startSession()

Starts a new session for transactions.

```javascript
const session = await db.startSession();
```

**Returns:** A Promise that resolves to a Session instance

#### backup(path)

Creates a backup of the database.

```javascript
await db.backup('./backups/mydb_backup');
```

**Parameters:**

- `path` (string): The directory path where the backup will be stored

**Returns:** A Promise that resolves when the backup is complete

#### close()

Closes the database connection and releases resources.

```javascript
await db.close();
```

**Returns:** A Promise that resolves when the database is closed

## Collection

### Collection Methods

#### insert(document)

Inserts a single document into the collection.

```javascript
const newUser = await users.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});
```

**Parameters:**

- `document` (object): The document to insert
- `options` (object, optional): Insert options
  - `session` (Session): Session for transaction support

**Returns:** A Promise that resolves to the inserted document (with `_id`)

#### insertMany(documents)

Inserts multiple documents into the collection.

```javascript
const newUsers = await users.insertMany([
  { name: 'Alice Smith', email: 'alice@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' }
]);
```

**Parameters:**

- `documents` (array): An array of documents to insert
- `options` (object, optional): Insert options
  - `session` (Session): Session for transaction support

**Returns:** A Promise that resolves to an array of inserted documents

#### find(query, options)

Finds documents that match the query.

```javascript
const results = await users.find({ age: { $gt: 25 } });
```

**Parameters:**

- `query` (object, optional): Query criteria (omit to find all documents)
- `options` (object, optional): Query options
  - `projection` (object): Fields to include or exclude
  - `sort` (object): Sort criteria
  - `limit` (number): Maximum number of documents to return
  - `skip` (number): Number of documents to skip
  - `session` (Session): Session for transaction support

**Returns:** A Promise that resolves to an array of matching documents

#### findOne(query, options)

Finds a single document that matches the query.

```javascript
const user = await users.findOne({ email: 'john@example.com' });
```

**Parameters:**

- `query` (object): Query criteria
- `options` (object, optional): Query options (same as `find`)

**Returns:** A Promise that resolves to the matching document or `null`

#### update(filter, update, options)

Updates a single document that matches the filter.

```javascript
const result = await users.update(
  { email: 'john@example.com' },
  { $set: { age: 31, lastUpdated: new Date() } }
);
```

**Parameters:**

- `filter` (object): Filter criteria
- `update` (object): Update operations
- `options` (object, optional): Update options
  - `upsert` (boolean): Insert if no documents match (default: `false`)
  - `returnDocument` (string): Return the updated document ('before' or 'after', default: 'after')
  - `session` (Session): Session for transaction support

**Returns:** A Promise that resolves to the updated document

#### updateMany(filter, update, options)

Updates multiple documents that match the filter.

```javascript
const result = await users.updateMany(
  { age: { $lt: 30 } },
  { $set: { group: 'young' } }
);
```

**Parameters:**

- `filter` (object): Filter criteria
- `update` (object): Update operations
- `options` (object, optional): Update options (same as `update`, except `returnDocument`)

**Returns:** A Promise that resolves to an object with `matchedCount` and `modifiedCount`

#### delete(filter, options)

Deletes a single document that matches the filter.

```javascript
const result = await users.delete({ email: 'john@example.com' });
```

**Parameters:**

- `filter` (object): Filter criteria
- `options` (object, optional): Delete options
  - `session` (Session): Session for transaction support

**Returns:** A Promise that resolves to the deleted document or `null`

#### deleteMany(filter, options)

Deletes multiple documents that match the filter.

```javascript
const result = await users.deleteMany({ inactive: true });
```

**Parameters:**

- `filter` (object): Filter criteria
- `options` (object, optional): Delete options (same as `delete`)

**Returns:** A Promise that resolves to an object with `deletedCount`

#### aggregate(pipeline)

Performs an aggregation pipeline operation.

```javascript
const results = await users.aggregate([
  { $match: { age: { $gt: 25 } } },
  { $group: { _id: '$department', avgAge: { $avg: '$age' } } },
  { $sort: { avgAge: -1 } }
]);
```

**Parameters:**

- `pipeline` (array): An array of aggregation stages
- `options` (object, optional): Aggregation options
  - `session` (Session): Session for transaction support

**Returns:** A Promise that resolves to the aggregation results

#### count(query)

Counts documents that match the query.

```javascript
const count = await users.count({ age: { $gt: 30 } });
```

**Parameters:**

- `query` (object, optional): Query criteria (omit to count all documents)
- `options` (object, optional): Count options
  - `session` (Session): Session for transaction support

**Returns:** A Promise that resolves to the count

#### createIndex(keys, options)

Creates an index on the specified fields.

```javascript
await users.createIndex({ email: 1 }, { unique: true });
```

**Parameters:**

- `keys` (object): Fields to index and their sort order (1 for ascending, -1 for descending)
- `options` (object, optional): Index options
  - `unique` (boolean): Whether the index should enforce uniqueness (default: `false`)
  - `name` (string): Custom name for the index

**Returns:** A Promise that resolves when the index is created

#### dropIndex(indexName)

Drops the specified index.

```javascript
await users.dropIndex('email_1');
```

**Parameters:**

- `indexName` (string): The name of the index to drop

**Returns:** A Promise that resolves when the index is dropped

#### listIndexes()

Lists all indexes on the collection.

```javascript
const indexes = await users.listIndexes();
```

**Returns:** A Promise that resolves to an array of index information

## Query Operators

JasonDB supports a variety of query operators for constructing complex queries:

### Comparison Operators

- `$eq`: Equal to
- `$ne`: Not equal to
- `$gt`: Greater than
- `$gte`: Greater than or equal to
- `$lt`: Less than
- `$lte`: Less than or equal to
- `$in`: In an array
- `$nin`: Not in an array

```javascript
// Examples
await users.find({ age: { $gt: 30 } });
await users.find({ status: { $in: ['active', 'pending'] } });
```

### Logical Operators

- `$and`: Logical AND
- `$or`: Logical OR
- `$not`: Logical NOT
- `$nor`: Logical NOR

```javascript
// Examples
await users.find({
  $and: [
    { age: { $gt: 25 } },
    { status: 'active' }
  ]
});

await users.find({
  $or: [
    { age: { $lt: 20 } },
    { age: { $gt: 60 } }
  ]
});
```

### Element Operators

- `$exists`: Field exists
- `$type`: Field is of specified type

```javascript
// Examples
await users.find({ phone: { $exists: true } });
await users.find({ age: { $type: 'number' } });
```

### Array Operators

- `$all`: Array contains all specified elements
- `$elemMatch`: Array contains an element matching all specified conditions
- `$size`: Array has specified size

```javascript
// Examples
await users.find({ tags: { $all: ['developer', 'javascript'] } });
await users.find({ scores: { $elemMatch: { $gt: 80, $lt: 90 } } });
await users.find({ friends: { $size: 3 } });
```

## Update Operators

JasonDB supports various operators for updating documents:

### Field Operators

- `$set`: Sets field values
- `$unset`: Removes fields
- `$rename`: Renames fields
- `$inc`: Increments field values
- `$mul`: Multiplies field values
- `$min`: Updates if new value is less than current
- `$max`: Updates if new value is greater than current

```javascript
// Examples
await users.update(
  { _id: 'user123' },
  { 
    $set: { status: 'active' },
    $inc: { loginCount: 1 },
    $rename: { 'old_field': 'new_field' }
  }
);
```

### Array Operators

- `$push`: Adds elements to an array
- `$pull`: Removes elements from an array
- `$addToSet`: Adds elements to an array if they don't exist
- `$pop`: Removes first or last element of an array

```javascript
// Examples
await users.update(
  { _id: 'user123' },
  { 
    $push: { tags: 'javascript' },
    $pull: { oldTags: 'deprecated' },
    $addToSet: { skills: 'Node.js' }
  }
);
```

## Transactions

JasonDB supports transactions for performing multiple operations atomically:

```javascript
const session = await db.startSession();

try {
  await session.startTransaction();
  
  // Perform multiple operations within the transaction
  await users.insert({ name: 'Chris Lee', email: 'chris@example.com' }, { session });
  await profiles.insert({ userId: 'chris_id', bio: 'Software developer' }, { session });
  
  // Commit the transaction if all operations succeed
  await session.commitTransaction();
} catch (error) {
  // Abort the transaction if any operation fails
  await session.abortTransaction();
  console.error('Transaction failed:', error);
} finally {
  await session.endSession();
}
```

## Events

JasonDB collections emit events that you can listen to:

```javascript
// Listen for document insertions
users.on('insert', (document) => {
  console.log('Document inserted:', document);
});

// Listen for document updates
users.on('update', (filter, update) => {
  console.log('Document updated with filter:', filter);
  console.log('Update operation:', update);
});

// Listen for document deletions
users.on('delete', (filter) => {
  console.log('Document deleted with filter:', filter);
});
```