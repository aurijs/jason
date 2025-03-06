# Getting Started with JasonDB

This guide will help you get up and running with JasonDB quickly. We'll cover installation, basic setup, and some common operations to help you start using JasonDB in your projects.

## Prerequisites

Before you begin, make sure you have:

- Node.js (v14 or later) or Python (v3.7 or later) installed
- Basic understanding of JavaScript/Python and JSON

## Installation

JasonDB is available for both Node.js and Python environments. Choose the installation method that matches your project:

### Node.js

```bash
npm install node-jason
```

Or if you're using Yarn:

```bash
yarn add node-jason
```

### Python

```bash
pip install python-jason
```

## Basic Usage

Here's a quick example to get you started with JasonDB:

### Node.js Example

```javascript
import { JasonDB } from 'node-jason';

// Initialize the database with a directory path
const db = new JasonDB('./data');

// Create or access a collection
const users = db.collection('users');

// Insert a document
async function addUser() {
  const newUser = await users.insert({
    name: 'Alice Smith',
    email: 'alice@example.com',
    age: 28,
    roles: ['admin', 'editor']
  });
  
  console.log('Added user:', newUser);
}

// Find documents
async function findUsers() {
  // Find all users over 25 years old
  const results = await users.find({ age: { $gt: 25 } });
  console.log('Found users:', results);
  
  // Find a specific user by ID
  const alice = await users.findOne({ name: 'Alice Smith' });
  console.log('Found Alice:', alice);
}

// Update a document
async function updateUser() {
  const updated = await users.update(
    { name: 'Alice Smith' },
    { $set: { age: 29, roles: ['admin', 'editor', 'reviewer'] } }
  );
  
  console.log('Updated user:', updated);
}

// Run our example
async function runExample() {
  await addUser();
  await findUsers();
  await updateUser();
}

runExample().catch(console.error);
```

### Python Example

```python
from python_jason import JasonDB

# Initialize the database with a directory path
db = JasonDB('./data')

# Create or access a collection
users = db.collection('users')

# Insert a document
def add_user():
    new_user = users.insert({
        'name': 'Bob Johnson',
        'email': 'bob@example.com',
        'age': 32,
        'roles': ['user', 'contributor']
    })
    
    print(f'Added user: {new_user}')

# Find documents
def find_users():
    # Find all users over 30 years old
    results = users.find({'age': {'$gt': 30}})
    print(f'Found users: {list(results)}')
    
    # Find a specific user by name
    bob = users.find_one({'name': 'Bob Johnson'})
    print(f'Found Bob: {bob}')

# Update a document
def update_user():
    updated = users.update(
        {'name': 'Bob Johnson'},
        {'$set': {'age': 33, 'roles': ['user', 'contributor', 'moderator']}}
    )
    
    print(f'Updated user: {updated}')

# Run our example
def run_example():
    add_user()
    find_users()
    update_user()

if __name__ == '__main__':
    run_example()
```

## Next Steps

Now that you've seen the basics of JasonDB, you can:

1. Check out the [Installation](/guide/installation) page for more detailed setup instructions
2. Learn about [Basic Operations](/guide/basic-operations) for more examples
3. Explore [Advanced Usage](/guide/advanced-usage) for more complex scenarios

JasonDB is designed to be intuitive and easy to use, so feel free to experiment with it in your projects. The API is consistent across both Node.js and Python platforms, making it easy to switch between environments as needed.