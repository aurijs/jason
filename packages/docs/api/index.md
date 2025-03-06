# API Reference Overview

This section provides detailed documentation for the JasonDB API. JasonDB offers consistent APIs across both Node.js and Python platforms, making it easy to use regardless of your preferred programming language.

## API Structure

The JasonDB API is organized around the following main components:

### Database

The main entry point for interacting with JasonDB. It allows you to create and manage collections, handle transactions, and perform database-level operations.

### Collections

Collections store documents (JSON objects) and provide methods for inserting, querying, updating, and deleting data.

### Queries

JasonDB supports a rich query language for finding documents that match specific criteria.

### Updates

A set of operators and methods for modifying existing documents in a collection.

## Language-Specific APIs

While the core concepts and methods are consistent across platforms, there are some language-specific differences in syntax and available features:

- [Node.js API](/api/node) - Documentation for the JavaScript implementation
- [Python API](/api/python) - Documentation for the Python implementation

## Common Patterns

Regardless of the language you're using, JasonDB follows these common patterns:

### Creating a Database Instance

```javascript
// Node.js
const db = new JasonDB('./data');
```

```python
# Python
db = JasonDB('./data')
```

### Working with Collections

```javascript
// Node.js
const users = db.collection('users');
```

```python
# Python
users = db.collection('users')
```

### Basic CRUD Operations

```javascript
// Node.js
// Create
const doc = await collection.insert({ name: 'Example' });

// Read
const results = await collection.find({ name: 'Example' });

// Update
const updated = await collection.update(
  { name: 'Example' },
  { $set: { status: 'active' } }
);

// Delete
const deleted = await collection.delete({ name: 'Example' });
```

```python
# Python
# Create
doc = collection.insert({'name': 'Example'})

# Read
results = collection.find({'name': 'Example'})

# Update
updated = collection.update(
  {'name': 'Example'},
  {'$set': {'status': 'active'}}
)

# Delete
deleted = collection.delete({'name': 'Example'})
```

## Error Handling

JasonDB provides consistent error handling across platforms:

```javascript
// Node.js
try {
  await users.insert({ /* invalid document */ });
} catch (error) {
  console.error('Error inserting document:', error.message);
}
```

```python
# Python
try:
  users.insert({ /* invalid document */ })
except Exception as error:
  print(f'Error inserting document: {str(error)}')
```

## Next Steps

Explore the language-specific API documentation for detailed information:

- [Node.js API](/api/node)
- [Python API](/api/python)

Or return to the [Guide](/guide/) for more examples and usage patterns.