# Advanced Usage

This guide covers more advanced features and usage patterns for JasonDB. Once you're comfortable with the [basic operations](/guide/basic-operations/), these advanced techniques will help you get the most out of JasonDB.

## Indexing

JasonDB supports indexing to improve query performance on frequently accessed fields.

### Creating Indexes

```javascript
// Node.js
const users = db.collection('users');

// Create a simple index on the email field
await users.createIndex({ email: 1 });

// Create a compound index on multiple fields
await users.createIndex({ age: 1, active: -1 });
```

```python
# Python
users = db.collection('users')

# Create a simple index on the email field
users.create_index({'email': 1})

# Create a compound index on multiple fields
users.create_index({'age': 1, 'active': -1})
```

The number values (1 or -1) indicate the sort order (ascending or descending) for the index.

### Listing Indexes

```javascript
// Node.js
const indexes = await users.listIndexes();
console.log('Collection indexes:', indexes);
```

```python
# Python
indexes = users.list_indexes()
print(f'Collection indexes: {indexes}')
```

### Dropping Indexes

```javascript
// Node.js
await users.dropIndex('email_1');
```

```python
# Python
users.drop_index('email_1')
```

## Transactions

JasonDB supports basic transactions to ensure data consistency when performing multiple operations.

```javascript
// Node.js
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

```python
# Python
with db.start_session() as session:
    try:
        session.start_transaction()
        
        # Perform multiple operations within the transaction
        users.insert({'name': 'Chris Lee', 'email': 'chris@example.com'}, session=session)
        profiles.insert({'user_id': 'chris_id', 'bio': 'Software developer'}, session=session)
        
        # Commit the transaction if all operations succeed
        session.commit_transaction()
    except Exception as e:
        # Abort the transaction if any operation fails
        session.abort_transaction()
        print(f'Transaction failed: {e}')
```

## Aggregation Pipeline

JasonDB provides an aggregation pipeline for complex data processing and analysis.

```javascript
// Node.js
const results = await users.aggregate([
  // Match stage - filter documents
  { $match: { age: { $gt: 25 } } },
  
  // Group stage - group documents by a field
  { $group: { 
    _id: '$department', 
    avgAge: { $avg: '$age' },
    count: { $sum: 1 }
  }},
  
  // Sort stage - sort the results
  { $sort: { avgAge: -1 } }
]);

console.log('Aggregation results:', results);
```

```python
# Python
results = users.aggregate([
  # Match stage - filter documents
  {'$match': {'age': {'$gt': 25}}},
  
  # Group stage - group documents by a field
  {'$group': {
    '_id': '$department',
    'avg_age': {'$avg': '$age'},
    'count': {'$sum': 1}
  }},
  
  # Sort stage - sort the results
  {'$sort': {'avg_age': -1}}
])

print(f'Aggregation results: {list(results)}')
```

## Data Validation

JasonDB allows you to define validation rules for your collections to ensure data integrity.

```javascript
// Node.js
const userSchema = {
  bsonType: 'object',
  required: ['name', 'email', 'age'],
  properties: {
    name: {
      bsonType: 'string',
      description: 'must be a string and is required'
    },
    email: {
      bsonType: 'string',
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
      description: 'must be a valid email address and is required'
    },
    age: {
      bsonType: 'int',
      minimum: 18,
      maximum: 120,
      description: 'must be an integer between 18 and 120 and is required'
    },
    phone: {
      bsonType: 'string',
      description: 'must be a string if provided'
    }
  }
};

await db.createCollection('validated_users', {
  validator: { $jsonSchema: userSchema }
});
```

```python
# Python
user_schema = {
  'bsonType': 'object',
  'required': ['name', 'email', 'age'],
  'properties': {
    'name': {
      'bsonType': 'string',
      'description': 'must be a string and is required'
    },
    'email': {
      'bsonType': 'string',
      'pattern': '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
      'description': 'must be a valid email address and is required'
    },
    'age': {
      'bsonType': 'int',
      'minimum': 18,
      'maximum': 120,
      'description': 'must be an integer between 18 and 120 and is required'
    },
    'phone': {
      'bsonType': 'string',
      'description': 'must be a string if provided'
    }
  }
}

db.create_collection('validated_users', {
  'validator': {'$jsonSchema': user_schema}
})
```

## Backup and Restore

JasonDB provides utilities for backing up and restoring your database.

```javascript
// Node.js

// Backup the database
await db.backup('./backup/mydb_backup');

// Restore from a backup
await JasonDB.restore('./backup/mydb_backup', './restored_data');
```

```python
# Python

# Backup the database
db.backup('./backup/mydb_backup')

# Restore from a backup
JasonDB.restore('./backup/mydb_backup', './restored_data')
```

## Performance Optimization

Here are some tips to optimize JasonDB performance in your applications:

1. **Use indexes** for frequently queried fields
2. **Limit query results** when you don't need all documents
3. **Use projection** to retrieve only the fields you need
4. **Batch operations** when inserting or updating multiple documents
5. **Monitor database size** and clean up old or unnecessary data

```javascript
// Node.js examples

// Use projection to retrieve only specific fields
const users = await collection.find(
  { age: { $gt: 30 } },
  { projection: { name: 1, email: 1, _id: 0 } }
);

// Limit query results
const recentUsers = await collection.find()
  .sort({ createdAt: -1 })
  .limit(10);
```

```python
# Python examples

# Use projection to retrieve only specific fields
users = collection.find(
  {'age': {'$gt': 30}},
  projection={'name': 1, 'email': 1, '_id': 0}
)

# Limit query results
recent_users = collection.find()\
  .sort('created_at', -1)\
  .limit(10)
```

## Event Listeners

JasonDB allows you to register event listeners for various database operations.

```javascript
// Node.js

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

```python
# Python

# Define event handlers
def on_insert(document):
    print(f'Document inserted: {document}')

def on_update(filter, update):
    print(f'Document updated with filter: {filter}')
    print(f'Update operation: {update}')

def on_delete(filter):
    print(f'Document deleted with filter: {filter}')

# Register event listeners
users.on('insert', on_insert)
users.on('update', on_update)
users.on('delete', on_delete)
```

## Next Steps

Now that you've explored the advanced features of JasonDB, you might want to:

- Check out the [API Reference](/api/) for detailed documentation
- Contribute to the project on [GitHub](https://github.com/lucas-augusto/jason)
- Join our community to share your experiences and get help

If you have any questions or need further assistance, please refer to the [GitHub repository](https://github.com/lucas-augusto/jason) for support.