# Basic Operations

This guide covers the fundamental operations you can perform with JasonDB. We'll walk through creating collections, inserting documents, querying data, updating records, and deleting information.

## Collections

In JasonDB, data is organized into collections. A collection is similar to a table in a relational database, but without a fixed schema.

### Creating a Collection

```javascript
// Node.js
const db = new JasonDB('./data');
const users = db.collection('users');
```

```python
# Python
db = JasonDB('./data')
users = db.collection('users')
```

If the collection doesn't exist, it will be created automatically. If it already exists, JasonDB will connect to the existing collection.

## Inserting Documents

You can insert documents (JSON objects) into a collection using the `insert` method.

### Insert a Single Document

```javascript
// Node.js
const newUser = await users.insert({
  name: 'Jane Smith',
  email: 'jane@example.com',
  age: 27,
  active: true
});

console.log('Inserted user:', newUser);
```

```python
# Python
new_user = users.insert({
  'name': 'Jane Smith',
  'email': 'jane@example.com',
  'age': 27,
  'active': True
})

print(f'Inserted user: {new_user}')
```

Each inserted document is automatically assigned a unique ID if one is not provided.

### Insert Multiple Documents

```javascript
// Node.js
const newUsers = await users.insertMany([
  { name: 'Alex Johnson', email: 'alex@example.com', age: 32 },
  { name: 'Sam Wilson', email: 'sam@example.com', age: 29 }
]);

console.log('Inserted users:', newUsers);
```

```python
# Python
new_users = users.insert_many([
  {'name': 'Alex Johnson', 'email': 'alex@example.com', 'age': 32},
  {'name': 'Sam Wilson', 'email': 'sam@example.com', 'age': 29}
])

print(f'Inserted users: {new_users}')
```

## Querying Documents

JasonDB provides several methods to retrieve documents from a collection.

### Find All Documents

```javascript
// Node.js
const allUsers = await users.find();
console.log('All users:', allUsers);
```

```python
# Python
all_users = list(users.find())
print(f'All users: {all_users}')
```

### Find Documents with a Query

```javascript
// Node.js
const activeUsers = await users.find({ active: true });
console.log('Active users:', activeUsers);
```

```python
# Python
active_users = list(users.find({'active': True}))
print(f'Active users: {active_users}')
```

### Find a Single Document

```javascript
// Node.js
const jane = await users.findOne({ name: 'Jane Smith' });
console.log('Found Jane:', jane);
```

```python
# Python
jane = users.find_one({'name': 'Jane Smith'})
print(f'Found Jane: {jane}')
```

### Query Operators

JasonDB supports various query operators for more complex queries:

```javascript
// Node.js examples

// Greater than
const olderUsers = await users.find({ age: { $gt: 30 } });

// Less than or equal
const youngUsers = await users.find({ age: { $lte: 25 } });

// In array
const specificUsers = await users.find({ name: { $in: ['Jane Smith', 'Alex Johnson'] } });

// Logical AND
const filteredUsers = await users.find({ 
  $and: [
    { age: { $gt: 25 } },
    { active: true }
  ]
});
```

```python
# Python examples

# Greater than
older_users = list(users.find({'age': {'$gt': 30}}))

# Less than or equal
young_users = list(users.find({'age': {'$lte': 25}}))

# In array
specific_users = list(users.find({'name': {'$in': ['Jane Smith', 'Alex Johnson']}}))

# Logical AND
filtered_users = list(users.find({
  '$and': [
    {'age': {'$gt': 25}},
    {'active': True}
  ]
}))
```

## Updating Documents

JasonDB provides methods to update existing documents in a collection.

### Update a Single Document

```javascript
// Node.js
const updated = await users.update(
  { name: 'Jane Smith' },
  { $set: { age: 28, role: 'admin' } }
);

console.log('Updated document:', updated);
```

```python
# Python
updated = users.update(
  {'name': 'Jane Smith'},
  {'$set': {'age': 28, 'role': 'admin'}}
)

print(f'Updated document: {updated}')
```

### Update Multiple Documents

```javascript
// Node.js
const result = await users.updateMany(
  { age: { $lt: 30 } },
  { $set: { group: 'young' } }
);

console.log('Updated count:', result.modifiedCount);
```

```python
# Python
result = users.update_many(
  {'age': {'$lt': 30}},
  {'$set': {'group': 'young'}}
)

print(f'Updated count: {result["modified_count"]}')
```

### Update Operators

JasonDB supports various update operators:

```javascript
// Node.js examples

// Set values
await users.update({ name: 'Alex Johnson' }, { $set: { role: 'editor' } });

// Increment values
await users.update({ name: 'Alex Johnson' }, { $inc: { age: 1 } });

// Add to array
await users.update({ name: 'Alex Johnson' }, { $push: { skills: 'JavaScript' } });

// Remove from array
await users.update({ name: 'Alex Johnson' }, { $pull: { skills: 'Python' } });
```

```python
# Python examples

# Set values
users.update({'name': 'Alex Johnson'}, {'$set': {'role': 'editor'}})

# Increment values
users.update({'name': 'Alex Johnson'}, {'$inc': {'age': 1}})

# Add to array
users.update({'name': 'Alex Johnson'}, {'$push': {'skills': 'JavaScript'}})

# Remove from array
users.update({'name': 'Alex Johnson'}, {'$pull': {'skills': 'Python'}})
```

## Deleting Documents

JasonDB provides methods to remove documents from a collection.

### Delete a Single Document

```javascript
// Node.js
const deleted = await users.delete({ name: 'Sam Wilson' });
console.log('Deleted:', deleted);
```

```python
# Python
deleted = users.delete({'name': 'Sam Wilson'})
print(f'Deleted: {deleted}')
```

### Delete Multiple Documents

```javascript
// Node.js
const result = await users.deleteMany({ age: { $lt: 25 } });
console.log('Deleted count:', result.deletedCount);
```

```python
# Python
result = users.delete_many({'age': {'$lt': 25}})
print(f'Deleted count: {result["deleted_count"]}')
```

## Next Steps

Now that you understand the basic operations in JasonDB, you can:

- Explore [Advanced Usage](/guide/advanced-usage) for more complex scenarios
- Check out the [API Reference](/api/) for detailed documentation

If you have any questions or encounter issues, please refer to the [GitHub repository](https://github.com/lucas-augusto/jason) for support.