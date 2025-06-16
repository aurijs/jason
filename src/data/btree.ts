export type KeyType = string | number | Date;
type DocumentPointer = string[];

interface BTreeNode {
	leaf: boolean;
	keys: KeyType[];
	children: BTreeNode[];
	pointers: DocumentPointer[];
	split: boolean; // Added to resolve "property 'split' missing" error
}

export interface BTreeOptions {
	order?: number;
	unique?: boolean;
	keyParser?: (key: KeyType) => KeyType;
}

export class BTreeIndex {
	private root: BTreeNode;
	private readonly order: number;
	private readonly unique: boolean;
	private readonly keyParser: (key: KeyType) => KeyType;

	/**
	 * Creates a new B-tree index instance
	 * @param options - Configuration options for the B-tree
	 * @param options.order - The order (degree) of the B-tree. Default is 3
	 * @param options.unique - Whether duplicate keys are allowed. Default is false
	 * @param options.keyParser - Custom function to parse/transform keys. Default uses internal parser
	 */
	constructor(options: BTreeOptions = {}) {
		this.order = options.order || 3;
		this.unique = options.unique || false;
		this.keyParser = options.keyParser || this.defaultKeyParser;
		this.root = this.createNode(true);
	}

	private defaultKeyParser(key: KeyType): KeyType {
		if (key instanceof Date) return key;
		if (typeof key === "number") return key;
		return String(key);
	}

	private createNode(leaf: boolean): BTreeNode {
		return {
			leaf,
			keys: [],
			children: [],
			pointers: [],
			split: false, // Initialize split property
		};
	}

	private compare(a: KeyType, b: KeyType): number {
		// Convert both values to a common comparable format
		const toComparable = (val: KeyType): string | number => {
			if (val instanceof Date) return val.getTime();
			if (typeof val === "number") return val;
			return String(val);
		};

		const aComp = toComparable(a);
		const bComp = toComparable(b);

		if (typeof aComp === "number" && typeof bComp === "number") {
			return aComp - bComp;
		}
		
		return String(aComp).localeCompare(String(bComp));
	}

	public insert(key: KeyType, docId: string): void {
		const parsedKey = this.keyParser(key);
		const root = this.root;

		if (root.keys.length === 2 * this.order - 1) {
			const newRoot = this.createNode(false);
			newRoot.children.push(root);
			this.root = newRoot;
			this.splitChild(newRoot, 0);
			this.insertNonFull(newRoot, parsedKey, docId);
		} else {
			this.insertNonFull(root, parsedKey, docId);
		}
	}

	private splitChild(parent: BTreeNode, index: number): void {
		const child = parent.children[index];
		const newNode = this.createNode(child.leaf);
		const middle = this.order - 1;

		newNode.keys = child.keys.splice(middle + 1);
		newNode.pointers = child.pointers.splice(middle + 1);

		if (!child.leaf) {
			newNode.children = child.children.splice(middle + 1);
		}

		parent.keys.splice(index, 0, child.keys[middle]);
		parent.pointers.splice(index, 0, child.pointers[middle]);
		parent.children.splice(index + 1, 0, newNode);

		child.keys.length = middle;
		child.pointers.length = middle;
	}

	private insertNonFull(node: BTreeNode, key: KeyType, docId: string): void {
		let i = node.keys.length - 1;

		if (node.leaf) {
			while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
				i--;
			}

			// Handle duplicate keys for non-unique indexes
			if (i >= 0 && this.compare(key, node.keys[i]) === 0) {
				if (this.unique) {
					throw new Error(`Duplicate key '${key}' not allowed in unique index`);
				} else {
					// Append to existing key's pointers
					node.pointers[i].push(docId);
				}
			} else {
				// Insert new key and pointers
				node.keys.splice(i + 1, 0, key);
				node.pointers.splice(i + 1, 0, [docId]);
			}
		} else {
			while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
				i--;
			}
			i++;

			if (node.children[i].keys.length === 2 * this.order - 1) {
				this.splitChild(node, i);
				if (this.compare(key, node.keys[i]) > 0) {
					i++;
				}
			}

			this.insertNonFull(node.children[i], key, docId);
		}
	}

	public delete(key: KeyType, docId: string): void {
		const parsedKey = this.keyParser(key);
		this.deleteRecursive(this.root, parsedKey, docId);

		if (this.root.keys.length === 0 && !this.root.leaf) {
			this.root = this.root.children[0];
		}
	}

	private deleteRecursive(node: BTreeNode, key: KeyType, docId: string): void {
		let i = 0;
		while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
			i++;
		}

		if (node.leaf) {
			if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
				const docIndex = node.pointers[i].indexOf(docId);
				if (docIndex > -1) {
					node.pointers[i].splice(docIndex, 1);
					if (node.pointers[i].length === 0) {
						node.keys.splice(i, 1);
						node.pointers.splice(i, 1);
					}
				}
			}
			return;
		}

		if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
			this.deleteInternalNode(node, key, i);
		} else {
			this.deleteRecursive(node.children[i], key, docId);
		}

		this.rebalance(node, i);
	}

	private deleteInternalNode(
		node: BTreeNode,
		key: KeyType,
		index: number,
	): void {
		// Delete from internal node
		const child = node.children[index];
		const rightChild = node.children[index+1];

		if (child.keys.length >= this.order) {
			const { key: predecessorKey, pointer: predecessorPointer } = this.getPredecessor(child);
			// Replace key with predecessor
			node.keys[index] = predecessorKey;
			node.pointers[index] = predecessorPointer;
			// Remove predecessor from child
			this.deleteRecursive(child, predecessorKey, predecessorPointer[0]);
		} else if (rightChild.keys.length >= this.order) {
			const { key: successorKey, pointer: successorPointer } = this.getSuccessor(rightChild);
			// Replace key with successor
			node.keys[index] = successorKey;
			node.pointers[index] = successorPointer;
			// Remove successor from right child
			this.deleteRecursive(rightChild, successorKey, successorPointer[0]);
		} else {
			// Merge child and rightChild
			this.mergeNodes(node, index);
			// Continue deletion on merged node - use original key and docId (key as string)
			// We need to search for the original key in the merged node
			this.deleteRecursive(child, key, key as string);
		}
	}

	private getPredecessor(node: BTreeNode): { key: KeyType; pointer: DocumentPointer } {
		let current = node;
		while (!current.leaf) {
			current = current.children[current.children.length - 1];
		}
		return {
			key: current.keys[current.keys.length - 1],
			pointer: current.pointers[current.pointers.length - 1]
		};
	}

	private getSuccessor(node: BTreeNode): { key: KeyType; pointer: DocumentPointer } {
		let current = node;
		while (!current.leaf) {
			current = current.children[0];
		}
		return {
			key: current.keys[0],
			pointer: current.pointers[0]
		};
	}

	private rebalance(node: BTreeNode, index: number): void {
		const child = node.children[index];
		if (child.keys.length >= this.order - 1) return;

		// Try borrow from left sibling
		if (index > 0) {
			const leftSibling = node.children[index-1];
			if (leftSibling.keys.length > this.order - 1) {
				// Rotate right
				child.keys.unshift(node.keys[index-1]);
				child.pointers.unshift(node.pointers[index-1]);
				
				node.keys[index-1] = leftSibling.keys.pop()!;
				node.pointers[index-1] = leftSibling.pointers.pop()!;
				
				if (!child.leaf) {
					child.children.unshift(leftSibling.children.pop()!);
				}
				return;
			}
		}

		// Try borrow from right sibling
		if (index < node.children.length - 1) {
			const rightSibling = node.children[index+1];
			if (rightSibling.keys.length > this.order - 1) {
				// Rotate left
				child.keys.push(node.keys[index]);
				child.pointers.push(node.pointers[index]);
				
				node.keys[index] = rightSibling.keys.shift()!;
				node.pointers[index] = rightSibling.pointers.shift()!;
				
				if (!child.leaf) {
					child.children.push(rightSibling.children.shift()!);
				}
				return;
			}
		}

		// Merge with sibling if borrowing fails
		if (index > 0) {
			this.mergeNodes(node, index-1);
		} else if (index < node.children.length - 1) {
			this.mergeNodes(node, index);
		}
	}

	public search(key: KeyType): string[] {
		const parsedKey = this.keyParser(key);
		return this.searchRecursive(this.root, parsedKey);
	}

	private searchRecursive(node: BTreeNode, key: KeyType): string[] {
		let i = 0;
		while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
			i++;
		}

		if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
			return node.pointers[i];
		}

		return node.leaf ? [] : this.searchRecursive(node.children[i], key);
	}

	public searchRange(min: number, max: number): string[] {
		const parsedMin = this.keyParser(min);
		const parsedMax = this.keyParser(max);
		const result: string[] = [];
		this.searchRangeRecursive(this.root, parsedMin, parsedMax, result);
		return [...new Set(result)];
	}

	private searchRangeRecursive(
		node: BTreeNode,
		min: KeyType,
		max: KeyType,
		result: string[],
	): void {
		let i = 0;
		while (i < node.keys.length && this.compare(node.keys[i], min) < 0) {
			i++;
		}

		while (i < node.keys.length && this.compare(node.keys[i], max) <= 0) {
			if (node.leaf) {
				result.push(...node.pointers[i]);
			} else {
				this.searchRangeRecursive(node.children[i], min, max, result);
			}
			i++;
		}

		if (!node.leaf) {
			this.searchRangeRecursive(node.children[i], min, max, result);
		}
	}

	public compact(): void {
		this.compactRecursive(this.root);
	}

	private compactRecursive(node: BTreeNode): void {
		if (node.leaf) return;

		// Compact all child nodes first
		for (const child of node.children) {
			this.compactRecursive(child);
		}

		// Check if any child needs compaction
		for (let i = 0; i < node.children.length; i++) {
			const child = node.children[i];
			if (child.keys.length >= this.order - 1) continue;

			// Try to borrow from left sibling
			if (i > 0) {
				const leftSibling = node.children[i-1];
				if (leftSibling.keys.length > this.order - 1) {
					// Borrow last key from left sibling
					child.keys.unshift(node.keys[i-1]);
					child.pointers.unshift(leftSibling.pointers.pop()!);
					node.keys[i-1] = leftSibling.keys.pop()!;
					if (!child.leaf) {
						child.children.unshift(leftSibling.children.pop()!);
					}
					continue;
				}
			}

			// Try to borrow from right sibling
			if (i < node.children.length - 1) {
				const rightSibling = node.children[i+1];
				if (rightSibling.keys.length > this.order - 1) {
					// Borrow first key from right sibling
					child.keys.push(node.keys[i]);
					child.pointers.push(rightSibling.pointers.shift()!);
					node.keys[i] = rightSibling.keys.shift()!;
					if (!child.leaf) {
						child.children.push(rightSibling.children.shift()!);
					}
					continue;
				}
			}

			// Merge with sibling if we couldn't borrow
			if (i > 0) {
				this.mergeNodes(node, i-1);
			} else if (i < node.children.length - 1) {
				this.mergeNodes(node, i);
			}
		}
	}

	private mergeNodes(parent: BTreeNode, index: number): void {
		const child = parent.children[index];
		const rightSibling = parent.children[index+1];

		// Move key from parent to child
		child.keys.push(parent.keys[index]);
		child.pointers.push(parent.pointers[index]);

		// Add keys and pointers from sibling
		child.keys.push(...rightSibling.keys);
		child.pointers.push(...rightSibling.pointers);

		// Add children if present
		if (!child.leaf) {
			child.children.push(...rightSibling.children);
		}

		// Remove key and sibling from parent
		parent.keys.splice(index, 1);
		parent.pointers.splice(index, 1);
		parent.children.splice(index+1, 1);
	}
}
