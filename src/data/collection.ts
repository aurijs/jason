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
	#getDocumentPath(id: string): string {
		return path.join(this.#basePath, `${id}.json`);
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
				this.#writer.write(id, stringify(document)),
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
			const documentPath = this.#getDocumentPath(id);
			const data = await readFile(documentPath, "utf-8");
			const document = parse(data) as Document<Collections, K>;

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
		const files = (
			await readdir(this.#basePath, { withFileTypes: true })
		).filter(
			(file) =>
				file.isFile() &&
				!file.name.startsWith("_") &&
				file.name.endsWith(".json"),
		);

		const batchSize = 100;
		const skip = options?.skip ?? 0;
		const limit = options?.limit;

		const effectiveLimit =
			limit !== undefined ? skip + limit : Number.POSITIVE_INFINITY;

		let result: Document<Collections, K>[] = [];
		for (
			let i = 0;
			i < files.length && result.length < effectiveLimit;
			i += batchSize
		) {
			const remaining = effectiveLimit - result.length;

			const currentBatchSize = Math.min(batchSize, remaining);
			const batch = files.slice(i, i + currentBatchSize);

			const batchResults = await Promise.all(
				batch.map((file) => this.read(file.name.replace(".json", ""))),
			);
			result = result.concat(
				batchResults.filter(Boolean) as Document<Collections, K>[],
			);
		}

		return result;
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

		await this.#writer.write(id, stringify(updated));
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

			unlink(documentPath);
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
		const jsonFiles = files
			.filter((file) => file.isFile() && file.name.endsWith(".json"))
			.map((file) => file.name);

		const results: Document<Collections, K>[] = [];
		const batchSize = options.batchSize ?? 100;
		for (let i = 0; i < jsonFiles.length; i += batchSize) {
			const batch = jsonFiles.slice(i, i + batchSize);
			const batchDocs = (await Promise.all(
				batch.map((name) => this.read(name.replace(".json", ""))),
			)) as Document<Collections, K>[];

			results.push(...batchDocs.filter((d) => d && filter(d)));
		}

		let finalResult = results;
		const skip = options.skip ?? 0;
		const limit = options.limit;

		if (skip > 0) {
			finalResult = results.slice(skip);
		}

		if (limit && limit >= 0) {
			finalResult = finalResult.slice(0, limit);
		}

		return finalResult;
	}
}
