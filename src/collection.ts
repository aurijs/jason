import crypto from "node:crypto";
import {
	access,
	mkdir,
	readdir,
	readFile,
	unlink,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import Cache from "./cache";
import type {
	BaseDocument,
	CollectionMetadata,
	ConcurrencyStrategy,
	ValidationFunction,
} from "./type";

export default class Collection<T extends BaseDocument> {
	private basePath: string;
	private metadataPath: string;
	private schema: ValidationFunction<T>;
	private concurrencyStrategy: ConcurrencyStrategy;
	private metadata: CollectionMetadata;
	private cache = new Cache<T>();

	constructor(
		basePath: string,
		name: string,
		options: {
			schema?: ValidationFunction<T>;
			concurrencyStrategy?: ConcurrencyStrategy;
			cacheTimeout?: number;
		} = {},
	) {
		this.basePath = path.join(basePath, name);
		this.metadataPath = path.join(this.basePath, "_metadata.json");
		this.schema = options.schema || (() => true);
		this.concurrencyStrategy = options.concurrencyStrategy || "optimistic";
		this.metadata = {
			name,
			documentCount: 0,
			indexes: [],
			lastModified: Date.now(),
		};
	}

	/**
	 * Returns the path to the document with the given id.
	 *
	 * @param id - The id of the document.
	 * @returns The path to the document.
	 */
	private getDocumentPath(id: string): string {
		return path.join(this.basePath, `${id}.json`);
	}

	/**
	 * Ensures the collection exists by creating the base path if it does not exist.
	 *
	 * If the base path does not exist, it is created recursively. Then, the collection
	 * metadata is saved to initialize the collection.
	 *
	 * @returns A promise that resolves when the collection exists.
	 */
	private async ensureCollectionExists(): Promise<void> {
		try {
			await access(this.basePath);
		} catch {
			await mkdir(this.basePath, { recursive: true });
			await this.saveMetadata();
		}
	}

	/**
	 * Loads the collection metadata from the file system.
	 *
	 * Reads the metadata file and parses its JSON content to update the
	 * metadata property. If the file cannot be read or does not exist,
	 * it initializes the metadata by saving the default metadata to
	 * the file system.
	 *
	 * @returns A promise that resolves when the metadata is loaded.
	 */
	private async loadMetadata(): Promise<void> {
		try {
			const data = await readFile(this.metadataPath, "utf8");
			this.metadata = JSON.parse(data);
		} catch {
			await this.saveMetadata();
		}
	}

	/**
	 * Saves the collection metadata to the file system.
	 *
	 * Serializes the metadata to JSON and writes it to the metadata file.
	 *
	 * @returns A promise that resolves when the metadata is saved.
	 */
	private async saveMetadata(): Promise<void> {
		await writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2));
	}

	/**
	 * Attempts to acquire a lock on a document by creating a lock file.
	 *
	 * Generates a unique lock ID and writes it to a lock file associated with the document.
	 * If the lock file is successfully created, it returns the lock ID. If an error occurs,
	 * it returns null.
	 *
	 * @param id - The id of the document to be locked.
	 * @returns A promise that resolves to the lock ID if the lock is successfully acquired, or null if it fails.
	 */
	private async acquireLock(id: string): Promise<string | null> {
		const lockPath = this.getDocumentPath(`${id}.lock`);
		try {
			const lockId = crypto.randomBytes(16).toString("hex");
			await writeFile(lockPath, lockId);
			return lockId;
		} catch {
			return null;
		}
	}

	/**
	 * Releases a lock on a document by deleting the lock file.
	 *
	 * Checks the lock ID against the one stored in the lock file and if they match, it deletes the lock file.
	 * If the lock ID does not match, it does not delete the file.
	 *
	 * @param id - The id of the document to be unlocked.
	 * @param lockId - The lock ID to match against the one stored in the lock file.
	 * @returns A promise that resolves when the lock is released.
	 */
	private async releaseLock(id: string, lockId: string): Promise<void> {
		const lockPath = this.getDocumentPath(`${id}.lock`);
		try {
			const savedLockId = await readFile(lockPath, "utf-8");
			if (savedLockId === lockId) {
				await unlink(lockPath);
			}
		} catch {}
	}

	/**
	 * Creates a new document in the collection.
	 *
	 * Ensures that the collection exists. Generates a random id for the document and validates it against the schema.
	 * If the document fails schema validation, it throws an error.
	 *
	 * If the concurrency strategy is "versioning", it adds versioning metadata to the document.
	 *
	 * @param data - The document data to be created.
	 * @returns A promise that resolves to the created document.
	 * @throws An error if the document failed schema validation or if the collection did not exist.
	 */
	async create(data: Omit<T, "_id">): Promise<T> {
		await this.ensureCollectionExists();

		const id = crypto.randomBytes(16).toString("hex");
		const document = { ...data, id } as T;

		if (!this.schema(document)) {
			throw new Error("Document failed schema validation");
		}

		if (this.concurrencyStrategy === "versioning") {
			document._version = 1;
			document._lastModified = Date.now();
		}

		const documentPath = this.getDocumentPath(id);
		await writeFile(documentPath, JSON.stringify(document, null, 2));
		this.metadata.documentCount++;
		this.metadata.lastModified = Date.now();
		await this.saveMetadata();

		this.cache.update(id, document);

		return document;
	}

	/**
	 * Reads a document from the collection.
	 *
	 * If the document was modified recently (less than 1 minute ago), it returns
	 * the cached version. Otherwise, it reads from disk and updates the cache.
	 *
	 * If the document does not exist, it returns null.
	 *
	 * @param id - The id of the document to read.
	 * @returns The document, or null if it does not exist.
	 */
	async read(id: string): Promise<T | null> {
		const cached = this.cache.get(id);
		if (cached?._lastModified && Date.now() - cached._lastModified < 60000) {
			return cached;
		}

		try {
			const documentPath = this.getDocumentPath(id);
			const data = await readFile(documentPath, "utf-8");
			const document = JSON.parse(data) as T;

			this.cache.update(id, document);
			return document;
		} catch {
			return null;
		}
	}

	/**
	 * Updates a document with the specified id using the provided data.
	 *
	 * If the concurrency strategy is "optimistic", it attempts to acquire a lock
	 * before proceeding with the update. If the lock cannot be acquired, an error
	 * is thrown. After updating, the lock is released.
	 *
	 * If the concurrency strategy is not "optimistic", the update is performed
	 * without locking.
	 *
	 * @param id - The id of the document to be updated.
	 * @param data - The partial data to update the document with.
	 * @returns A promise that resolves to the updated document or null if the
	 * document does not exist.
	 * @throws An error if the lock cannot be acquired or if the update operation
	 * encounters an error.
	 */
	async update(id: string, data: Partial<T>): Promise<T | null> {
		if (this.concurrencyStrategy === "optimistic") {
			const lockId = await this.acquireLock(id);
			if (!lockId) {
				throw new Error("Failed to acquire lock");
			}

			try {
				const result = await this._update(id, data);
				await this.releaseLock(id, lockId);
				return result;
			} catch (error) {
				await this.releaseLock(id, lockId);
				throw error;
			}
		} else {
			return this._update(id, data);
		}
	}

	/**
	 * Updates a document with the given id and data.
	 *
	 * If the document does not exist, it will return null.
	 *
	 * If the concurrency strategy is "optimistic", it will throw an error if the document has been modified since the last read.
	 *
	 * @param id - The id of the document to update.
	 * @param data - The partial document to merge with the existing document.
	 * @returns A promise that resolves to the updated document or null if it does not exist.
	 * @throws An error if the document failed schema validation or if the version number has changed.
	 */
	private async _update(id: string, data: Partial<T>): Promise<T | null> {
		const current = await this.read(id);
		if (!current) return null;
		if (
			this.concurrencyStrategy === "versioning" &&
			data._version !== undefined &&
			data._version !== current._version
		) {
			throw new Error(
				"Version mismatch. The document was modified by another process",
			);
		}

		const updated = {
			...current,
			...data,
			_version:
				this.concurrencyStrategy === "versioning"
					? (current._version || 0) + 1
					: undefined,
			_lastModified: Date.now(),
		} as T;

		if (!this.schema(updated)) {
			throw new Error("Document failed schema validation");
		}

		const documentPath = this.getDocumentPath(id);
		await writeFile(documentPath, JSON.stringify(updated, null, 2));
		await this.saveMetadata();
		this.cache.update(id, updated);
		return updated;
	}

	/**
	 * Deletes a document from the collection.
	 *
	 * @param id - The id of the document to be deleted.
	 * @returns A promise that resolves to true if the document was successfully deleted, or false if the deletion failed.
	 */
	async delete(id: string): Promise<boolean> {
		try {
			const documentPath = this.getDocumentPath(id);
			await unlink(documentPath);

			this.metadata.documentCount--;
			this.metadata.lastModified = Date.now();
			await this.saveMetadata();

			this.cache.delete(id);

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Queries the collection for documents matching the given filter function.
	 *
	 * @param filter - A function that takes a document as an argument and returns a boolean indicating whether the document matches the query.
	 * @returns A promise that resolves to an array of documents that matched the query.
	 */
	async query(filter: (doc: T) => boolean): Promise<T[]> {
		const results: T[] = [];
		for await (const file of await readdir(this.basePath)) {
			if (file.endsWith(".json") && !file.startsWith("_")) {
				const document = path.join(this.basePath, file);
				const data = await readFile(document, "utf-8");
				const doc = JSON.parse(data) as T;
				if (filter(doc)) {
					results.push(doc);
				}
			}
		}

		return results;
	}
}
