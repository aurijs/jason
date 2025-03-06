# Python API Reference

This page documents the Python implementation of JasonDB. The API is designed to be intuitive and easy to use, with a Pythonic interface that follows common Python conventions.

## Installation

```bash
pip install python-jason
```

Or using pipenv:

```bash
pipenv install python-jason
```

## Importing

```python
from python_jason import JasonDB
```

## Database

### Creating a Database Instance

```python
db = JasonDB(path, **options)
```

**Parameters:**

- `path` (str): The directory path where database files will be stored
- `options` (keyword arguments):
  - `auto_create` (bool): Automatically create the directory if it doesn't exist (default: `True`)
  - `compression` (bool): Enable data compression (default: `False`)
  - `serialization_format` (str): Format for serializing data ('json' or 'bson', default: 'json')

### Database Methods

#### collection(name)

Creates or retrieves a collection.

```python
users = db.collection('users')
```

**Parameters:**

- `name` (str): The name of the collection

**Returns:** A Collection instance

#### create_collection(name, **options)

Explicitly creates a new collection with options.

```python
users = db.create_collection('users', 
                            validator={'$jsonSchema': user_schema})
```

**Parameters:**

- `name` (str): The name of the collection
- `options` (keyword arguments):
  - `validator` (dict): Schema validation rules
  - `validation_level` (str): When validation is applied ('strict' or 'moderate', default: 'strict')

**Returns:** A Collection instance

#### drop_collection(name)

Removes a collection and all its data.

```python
db.drop_collection('users')
```

**Parameters:**

- `name` (str): The name of the collection to drop

**Returns:** `True` if successful

#### list_collections()

Lists all collections in the database.

```python
collections = db.list_collections()
print(collections)  # ['users', 'products', ...]
```

**Returns:** A list of collection names

#### start_session()

Starts a new session for transactions.

```python
session = db.start_session()
```

**Returns:** A Session instance

#### backup(path)

Creates a backup of the database.

```python
db.backup('./backups/mydb_backup')
```

**Parameters:**

- `path` (str): The directory path where the backup will be stored

#### close()

Closes the database connection and releases resources.

```python
db.close()
```

## Collection

### Collection Methods

#### insert(document, **options)

Inserts a single document into the collection.

```python
new_user = users.insert({
  'name': 'John Doe',
  'email': 'john@example.com',
  'age': 30
})
```

**Parameters:**

- `document` (dict): The document to insert
- `options` (keyword arguments):
  - `session` (Session): Session for transaction support

**Returns:** The inserted document (with `_id`)

#### insert_many(documents, **options)

Inserts multiple documents into the collection.

```python
new_users = users.insert_many([
  {'name': 'Alice Smith', 'email': 'alice@example.com'},
  {'name': 'Bob Johnson', 'email': 'bob@example.com'}
])
```

**Parameters:**

- `documents` (list): A list of documents to insert
- `options` (keyword arguments):
  - `session` (Session): Session for transaction support

**Returns:** A list of inserted documents

#### find(query=None, **options)

Finds documents that match the query.

```python
results = users.find({'age': {'$gt': 25}})
```

**Parameters:**

- `query` (dict, optional): Query criteria (omit to find all documents)
- `options` (keyword arguments):
  - `projection` (dict): Fields to include or exclude
  - `sort` (dict or list): Sort criteria
  - `limit` (int): Maximum number of documents to return
  - `skip` (int): Number of documents to skip
  - `session` (Session): Session for transaction support

**Returns:** A cursor to iterate over matching documents

#### find_one(query, **options)

Finds a single document that matches the query.

```python
user = users.find_one({'email': 'john@example.com'})
```

**Parameters:**

- `query` (dict): Query criteria
- `options` (keyword arguments): Query options (same as `find`)

**Returns:** The matching document or `None`

#### update(filter, update, **options)

Updates a single document that matches the filter.

```python
result = users.update(
  {'email': 'john@example.com'},
  {'$set': {'age': 31, 'last_updated': datetime.now()}}
)
```

**Parameters:**

- `filter` (dict): Filter criteria
- `update` (dict): Update operations
- `options` (keyword arguments):
  - `upsert` (bool): Insert if no documents match (default: `False`)
  - `return_document` (str): Return the updated document ('before' or 'after', default: 'after')
  - `session` (Session): Session for transaction support

**Returns:** The updated document

#### update_many(filter, update, **options)

Updates multiple documents that match the filter.

```python
result = users.update_many(
  {'age': {'$lt': 30}},
  {'$set': {'group': 'young'}}
)
```

**Parameters:**

- `filter` (dict): Filter criteria
- `update` (dict): Update operations
- `options` (keyword arguments): Update options (same as `update`, except `return_document`)

**Returns:** A dictionary with `matched_count` and `modified_count`

#### delete(filter, **options)

Deletes a single document that matches the filter.

```python
result = users.delete({'email': 'john@example.com'})
```

**Parameters:**

- `filter` (dict): Filter criteria
- `options` (keyword arguments):
  - `session` (Session): Session for transaction support

**Returns:** The deleted document or `None`

#### delete_many(filter, **options)

Deletes multiple documents that match the filter.

```python
result = users.delete_many({'inactive': True})
```

**Parameters:**

- `filter` (dict): Filter criteria
- `options` (keyword arguments): Delete options (same as `delete`)

**Returns:** A dictionary with `deleted_count`

#### aggregate(pipeline, **options)

Performs an aggregation pipeline operation.

```python
results = users.aggregate([
  {'$match': {'age': {'$gt': 25}}},
  {'$group': {'_id': '$department', 'avg_age': {'$avg': '$age'}}},
  {'$sort': {'avg_age': -1}}
])
```

**Parameters:**

- `pipeline` (list): A list of aggregation stages
- `options` (keyword arguments):
  - `session` (Session): Session for transaction support

**Returns:** A cursor to iterate over the aggregation results

#### count(query=None, **options)

Counts documents that match the query.

```python
count = users.count({'age': {'$gt': 30}})
```

**Parameters:**

- `query` (dict, optional): Query criteria (omit to count all documents)
- `options` (keyword arguments):
  - `session` (Session): Session for transaction support

**Returns:** The count

#### create_index(keys, **options)

Creates an index on the specified fields.

```python
users.create_index({'email': 1}, unique=True)
```

**Parameters:**

- `keys` (dict): Fields to index and their sort order (1 for ascending, -1 for descending)
- `options` (keyword arguments):
  - `unique` (bool): Whether the index should enforce uniqueness (default: `False`)
  - `name` (str): Custom name for the index

#### drop_index(index_name)

Drops the specified index.

```python
users.drop_index('email_1')
```

**Parameters:**

- `index_name` (str): The name of the index to drop

#### list_indexes()

Lists all indexes on the collection.

```python
indexes = users.list_indexes()
```

**Returns:** A list of index information

## Query Operators

JasonDB supports a variety of query operators for constructing complex queries:

### Comparison Operators

- `$eq`: Equal to
- `$ne`: Not equal to
- `$gt`: Greater than
- `$gte`: Greater than or equal to
- `$lt`: Less than
- `$lte`: Less than or equal to
- `$in`: In a list
- `$nin`: Not in a list

```python
# Examples
users.find({'age': {'$gt': 30}})
users.find({'status': {'$in': ['active', 'pending']}})
```

### Logical Operators

- `$and`: Logical AND
- `$or`: Logical OR
- `$not`: Logical NOT
- `$nor`: Logical NOR

```python
# Examples
users.find({
  '$and': [
    {'age': {'$gt': 25}},
    {'status': 'active'}
  ]
})

users.find({
  '$or': [
    {'age': {'$lt': 20}},
    {'age': {'$gt': 60}}
  ]
})
```

### Element Operators

- `$exists`: Field exists
- `$type`: Field is of specified type

```python
# Examples
users.find({'phone': {'$exists': True}})
users.find({'age': {'$type': 'int'}})
```

### Array Operators

- `$all`: Array contains all specified elements
- `$elemMatch`: Array contains an element matching all specified conditions
- `$size`: Array has specified size

```python
# Examples
users.find({'tags': {'$all': ['developer', 'python']}})
users.find({'scores': {'$elemMatch': {'$gt': 80, '$lt': 90}}})
users.find({'friends': {'$size': 3}})
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

```python
# Examples
users.update(
  {'_id': 'user123'},
  { 
    '$set': {'status': 'active'},
    '$inc': {'login_count': 1},
    '$rename': {'old_field': 'new_field'}
  }
)
```

### Array Operators

- `$push`: Adds elements to an array
- `$pull`: Removes elements from an array
- `$addToSet`: Adds elements to an array if they don't exist
- `$pop`: Removes first or last element of an array

```python
# Examples
users.update(
  {'_id': 'user123'},
  { 
    '$push': {'tags': 'python'},
    '$pull': {'old_tags': 'deprecated'},
    '$addToSet': {'skills': 'Django'}
  }
)
```

## Transactions

JasonDB supports transactions for performing multiple operations atomically:

```python
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

## Events

JasonDB collections can register event handlers:

```python
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