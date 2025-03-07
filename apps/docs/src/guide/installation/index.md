# Installation

This guide provides detailed instructions for installing JasonDB in different environments. JasonDB is available for both Node.js and Python, with consistent APIs across both platforms.

## Node.js Installation

You can install the Node.js version of JasonDB using npm or yarn.

### Using npm

```bash
npm install node-jason
```

### Using Yarn

```bash
yarn add node-jason
```

### Using Bun

```bash
bun add node-jason
```

## Python Installation

You can install the Python version of JasonDB using pip.

```bash
pip install python-jason
```

Or if you prefer using pipenv:

```bash
pipenv install python-jason
```

## Verifying Installation

After installation, you can verify that JasonDB is installed correctly by creating a simple test script.

### Node.js Verification

Create a file named `test-jason.js` with the following content:

```javascript
import { JasonDB } from 'node-jason';

// Create a new database instance
const db = new JasonDB('./test-db');
console.log('JasonDB initialized successfully!');

// Create a test collection
const testCollection = db.collection('test');
console.log('Test collection created!');
```

Run the script:

```bash
node test-jason.js
```

If everything is working correctly, you should see the success messages in your console.

### Python Verification

Create a file named `test_jason.py` with the following content:

```python
from python_jason import JasonDB

# Create a new database instance
db = JasonDB('./test-db')
print('JasonDB initialized successfully!')

# Create a test collection
test_collection = db.collection('test')
print('Test collection created!')
```

Run the script:

```bash
python test_jason.py
```

If everything is working correctly, you should see the success messages in your console.

## Next Steps

Now that you have JasonDB installed, you can:

- Learn about [Basic Operations](/guide/basic-operations/) to start working with your data
- Check out the [API Reference](/api/) for detailed documentation
- Explore [Advanced Usage](/guide/advanced-usage/) for more complex scenarios

If you encounter any issues during installation, please check the [GitHub repository](https://github.com/lucas-augusto/jason) for troubleshooting or to report a bug.