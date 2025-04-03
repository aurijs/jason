import crypto from "node:crypto";
import { access, mkdir, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "devalue";
import { DeleteOperationError, DocumentNotFoundError } from "../core/errors.js";
import Writer from "../io/writer.js";
import type {
	CollectionOptions,
	CollectionParam,
	Document,
	ValidationFunction,
} from "../types/index.js";
import Cache from "./cache.js";
import Metadata from "./metadata.js";

export default class Collection<Collections, K extends keyof Collections> {
	#basePath: string;
	#schema: ValidationFunction<Document<Collections, K>>;
	#metadata: Metadata | null;
	#cache: Cache<Document<Collections, K>>;
	#writer: Writer;

	/**
	 * Constructs a new Collection.
	 *
	 * @param basePath - The base path where the collection data will be stored.
	 * @param name - The name of the collection.
	 * @param options - Options for the collection.
	 * @param options.schema - The schema validation function for the collection.
	 * @param options.concurrencyStrategy - The concurrency strategy of the collection.
	 * @param options.cacheTimeout - The cache timeout in milliseconds.
	 */
	constructor(
		basePath: string,
		name: K,
		options: CollectionOptions<Document<Collections, K>> = {},
	) {
		this.#basePath = path.join(basePath, name as string);
		this.#schema = options.schema || (() => true);

		this.#metadata = options.generateMetadata
			? new Metadata(this.#basePath)
			: null;

		this.#writer = new Writer(this.#basePath);

		this.#cache = new Cache<Document<Collections, K>>(options.cacheTimeout);

		this.#ensureCollectionExists();
	}

	/**
	 * Ensures the collection exists by creating the base path if it does not exist.
	 *
	 * If the base path does not exist, it is created recursively. Then, the collection
	 * metadata is saved to initialize the collection.
	 *
	 * @returns A promise that resolves when the collection exists.
	 */
	async #ensureCollectionExists(): Promise<void> {
		try {
			await access(this.#basePath);
			return;
		} catch {
			try {
				await mkdir(this.#basePath, { recursive: true });
				return;
			} catch (error) {
				console.error("Failed to create collection directory", {
					path: this.#basePath,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				throw new Error(
					`Failed to create collection directory: ${this.#basePath}`,
				);
			}
		}
	}

	/**
	 * Returns the path to the document with the given id.
	 *
	 * @param id - The id of the document.
	 * @returns The path to the document.
	 */
	#encodeId(id: string): string {
		return Buffer.from(id).toString("base64url");
	}

	#decodeId(encodedId: string): string {
		return Buffer.from(encodedId, "base64url").toString("utf-8");
	}

	#getDocumentPath(id: string): string {
		// Encode the ID to make it filesystem-safe
		const encodedId = this.#encodeId(id);
		return path.join(this.#basePath, `${encodedId}.json`);
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
	async create(data: CollectionParam<Collections, K>) {
		try {
			await this.#ensureCollectionExists();
			await this.#metadata?.load();

			const id = (data as Document<Collections, K>).id ?? crypto.randomUUID();
			const document = { ...data, id } as Document<Collections, K>;

			if (!this.#schema(document)) {
				throw new Error("Document failed schema validation");
			}

			await Promise.all([
				// Use encoded ID for the writer filename
				this.#writer.write(this.#encodeId(id), stringify(document)),
				this.#metadata?.incrementDocumentCount(),
			]);

			this.#cache.update(id, document);

			return document;
		} catch (error) {
			if ((error as Error).message === "Document failed schema validation") {
				throw error;
			}
			throw new Error("Failed to create document");
		}
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
	async read(id: string) {
		const cached = this.#cache.get(id);
		if (cached) return cached;

		try {
			// Read file using encoded ID
			const documentPath = this.#getDocumentPath(id);
			const data = await readFile(documentPath, "utf-8");
			const document = parse(data) as Document<Collections, K>;

			if (document.id !== id) {
				return null;
			}
			this.#cache.update(id, document);
			return document;
		} catch {
			return null;
		}
	}

	/**
	 * Reads all documents from the collection.
	 *
	 * Returns an array of documents.
	 *
	 * @param options - Optional parameters to control the result.
	 * @param options.skip - The number of documents to skip.
	 * @param options.limit - The maximum number of documents to return.
	 * @returns A promise that resolves to an array of documents.
	 */
	async readAll(options?: { skip?: number; limit?: number }) {
		const files = (await readdir(this.#basePath, { withFileTypes: true }))
			.filter(
				(file) =>
					file.isFile() &&
					!file.name.startsWith("_") && // Ignore metadata/temp files
					file.name.endsWith(".json"),
			)
			.map((file) => file.name) // Get only names
			.sort(); // Sort filenames for deterministic order

		const skip = options?.skip ?? 0;
		const limit = options?.limit ?? Number.POSITIVE_INFINITY;

		// Read all relevant files first
		const allDocs = (
			await Promise.all(
				files.map((fileName) => {
					// Decode the filename (without .json) back to the original ID
					const originalId = this.#decodeId(fileName.replace(".json", ""));
					return this.read(originalId);
				}),
			)
		).filter(Boolean) as Document<Collections, K>[];

		let finalResult = allDocs;
		if (skip > 0) {
			finalResult = finalResult.slice(skip);
		}

		if (limit !== Number.POSITIVE_INFINITY) {
			finalResult = finalResult.slice(0, limit);
		}
		return finalResult;
	}

	/**
	 * Checks if a document with the specified id exists in the collection.
	 *
	 * @param id - The id of the document to check.
	 * @returns A promise that resolves to true if the document exists, false otherwise.
	 */
	async has(id: string) {
		try {
			await access(this.#getDocumentPath(id));
			return true;
		} catch {
			return false;
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
	async update(id: string, data: Partial<CollectionParam<Collections, K>>) {
		const current = await this.read(id);
		if (!current) return null;

		const updated = {
			...current,
			...data,
			id: current.id,
		} as Document<Collections, K>;

		if (!this.#schema(updated)) {
			throw new Error("Document failed schema validation");
		}

		// Use encoded ID for the writer filename
		await this.#writer.write(this.#encodeId(id), stringify(updated));
		await this.#metadata?.updateLastModified();
		this.#cache.update(id, updated);

		return updated;
	}

	/**
	 * Deletes a document with the specified id from the collection.
	 *
	 * @param id - The id of the document to delete.
	 * @returns A promise that resolves to true if the document is successfully
	 * deleted.
	 * @throws DocumentNotFoundError if the document does not exist.
	 * @throws DeleteOperationError if an error is encountered during the deletion
	 * operation.
	 */
	async delete(id: string) {
		try {
			const documentPath = this.#getDocumentPath(id);

			if (!(await this.has(id))) {
				throw new DocumentNotFoundError(`Document: ${id} not found`);
			}

			await unlink(documentPath);
			this.#metadata?.decrementDocumentCount();
			this.#cache.delete(id);

			return true;
		} catch (error) {
			throw new DeleteOperationError("Failed to delete document", error);
		}
	}

	/**
	 * Queries documents in the collection based on the provided filter function.
	 *
	 * Retrieves documents from the collection, applies the filter function to each
	 * document, and returns an array of documents that match the filter criteria.
	 * Supports concurrent processing and batch processing for efficiency.
	 *
	 * @param filter - A function that takes a document and returns a boolean
	 * indicating whether the document matches the filter criteria.
	 * @param options - Optional parameters to control the query execution.
	 * @param options.batchSize - The number of documents to process in each batch.
	 * @param options.skip - The number of documents to skip from the start of the
	 * result.
	 * @param options.limit - The maximum number of documents to return.
	 * @returns A promise that resolves to an array of documents matching the filter
	 * criteria.
	 */
	async query(
		filter: (doc: Document<Collections, K>) => boolean,
		options: {
			batchSize?: number;
			skip?: number;
			limit?: number;
		} = {},
	) {
		const files = await readdir(this.#basePath, { withFileTypes: true });
		const allJsonFiles = files
			.filter(
				(file) =>
					file.isFile() &&
					!file.name.startsWith("_") && // Ignore metadata/temp files
					file.name.endsWith(".json"),
			)
			.map((file) => file.name);

		const results: Document<Collections, K>[] = [];
		const batchSize = options.batchSize ?? 100;
		// Process files in batches
		for (let i = 0; i < allJsonFiles.length; i += batchSize) {
			const batchFileNames = allJsonFiles.slice(i, i + batchSize);
			const batchDocs = (
				await Promise.all(
					batchFileNames.map((fileName) => {
						// Decode filename back to ID for read
						const originalId = this.#decodeId(fileName.replace(".json", ""));
						return this.read(originalId);
					}),
				)
			).filter(Boolean) as Document<Collections, K>[]; // Filter nulls early

			// Apply user filter to the valid documents in the batch
			results.push(...batchDocs.filter(filter));

			// Early exit if limit (applied later) is already reached
			if (options.limit && results.length >= (options.skip ?? 0) + options.limit) {
				break;
			}
		}

		let finalResult = results;
		const skip = options.skip ?? 0;
		const limit = options.limit;

		if (skip > 0) {
			finalResult = finalResult.slice(skip);
		}

		if (limit && limit >= 0) {
			finalResult = finalResult.slice(0, limit);
		}

		return finalResult;
	}

	/**
		* Executes a provided function once for each collection element.
		*
		* Iterates through all documents in the collection and executes the callback
		* function for each one, passing the document, its ID, and the collection
		* instance. Handles both synchronous and asynchronous callbacks sequentially.
		*
		* @param callback - Function to execute for each element, accepting three arguments:
		*   - `value`: The current document being processed.
		*   - `id`: The ID of the current document being processed.
		*   - `collection`: The collection instance `forEach` was called upon.
		* @returns A promise that resolves when all callbacks have been executed.
		*/
	async forEach(
		callback: (
			value: Document<Collections, K>,
			id: string,
			collection: this,
		) => void | Promise<void>,
	): Promise<void> {
		// Fetch all documents first. readAll handles batching internally.
		const documents = await this.readAll();

		// Iterate sequentially, awaiting async callbacks
		for (const doc of documents) {
			// Add null check to satisfy TypeScript, although readAll filters nulls
			if (doc) {
				// The id is guaranteed to be present on the Document type.
				await callback(doc, doc.id, this);
			}
		}
	}
}
