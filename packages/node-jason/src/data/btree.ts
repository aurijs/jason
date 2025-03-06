type KeyType = string | number | Date;
type DocumentPointer = string[];

interface BTreeNode {
	leaf: boolean;
	keys: KeyType[];
	children: BTreeNode[];
	pointers: DocumentPointer[];
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
		};
	}

	private compare(a: KeyType, b: KeyType): number {
		if (typeof a !== typeof b) {
			throw new Error(
				`Cannot compare different types: ${typeof a} vs ${typeof b}`,
			);
		}

		if (a instanceof Date && b instanceof Date) {
			return a.getTime() - b.getTime();
		}

		if (typeof a === "string" && typeof b === "string") {
			return a.localeCompare(b);
		}

		return Number(a) - Number(b);
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

			if (this.unique && i >= 0 && this.compare(key, node.keys[i]) === 0) {
				throw new Error(`Duplicate key '${key}' not allowed in unique index`);
			}

			node.keys.splice(i + 1, 0, key);
			node.pointers.splice(i + 1, 0, [docId]);
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
		// Implementação complexa de exclusão em nós internos
		// (omitted for brevity, mas essencial para integridade)
	}

	private rebalance(node: BTreeNode, index: number): void {
		// Implementação de rebalanceamento após exclusão
		// (omitted for brevity)
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
		if (!node.leaf) {
			for (const child of node.children) {
				this.compactRecursive(child);
			}
		}

		if (node.keys.length < this.order - 1 && node !== this.root) {
			// Lógica de merge de nós
		}
	}
}
