import { Mutex } from "async-mutex";
import { parse, stringify } from "devalue";
import crypto from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  unlink
} from "node:fs/promises";
import path from "node:path";
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
    options: CollectionOptions<Document<Collections, K>> = {}
  ) {
    this.#basePath = path.join(basePath, name as string);
    this.#schema = options.schema || (() => true);

    this.#metadata = options.generateMetadata
      ? new Metadata(this.#basePath)
      : null;

    this.#writer = new Writer(this.#basePath);

    this.#cache = new Cache<Document<Collections, K>>(options.cacheTimeout);

    this.ensureCollectionExists();
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
    const maxRetries = 3;
    const baseDelay = 10;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await access(this.#basePath);
        return;
      } catch {
        try {
          await mkdir(this.#basePath, { recursive: true });
          return;
        } catch (error) {
          if (attempt === maxRetries) {
            console.error("Failed to create collection directory", {
              path: this.#basePath,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            throw new Error(
              `Failed to create collection directory: ${this.#basePath}`
            );
          }
          await new Promise((resolve) =>
            setTimeout(resolve, baseDelay * attempt)
          );
        }
      }
    }
  }

  /**
   * Returns the path to the document with the given id.
   *
   * @param id - The id of the document.
   * @returns The path to the document.
   */
  private getDocumentPath(id: string): string {
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
      await this.ensureCollectionExists();
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
      const documentPath = this.getDocumentPath(id);
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
    const files = await readdir(this.#basePath, { withFileTypes: true });
    const batchSize = 100;

    let result: Document<Collections, K>[] = [];
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((file) => this.read(file.name.replace(".json", "")))
      );
      result = result.concat(
        batchResults.filter(Boolean) as Document<Collections, K>[]
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
      await access(this.getDocumentPath(id));
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
   * Deletes a document from the collection.
   *
   * @param id - The id of the document to be deleted.
   * @returns A promise that resolves to true if the document was successfully deleted, or false if the deletion failed.
   */
  async delete(id: string) {
    const deleteMutex = new Mutex();

    try {
      await deleteMutex.acquire();

      const documentPath = this.getDocumentPath(id);

      const [documentExists] = await Promise.allSettled([
        access(documentPath),
        this.#cache.get(id), 
      ]);

      if (documentExists.status === "rejected") {
        throw new DocumentNotFoundError(`Document: ${id} not found`);
      }

      await Promise.race([
        unlink(documentPath),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Delete operation timeout")), 500)
        ),
      ]);

      await Promise.all([
        this.#metadata?.decrementDocumentCount(),
        this.#cache.delete(id),
      ]);

      return true;
    } catch (error) {
      // Erro customizado para melhor rastreabilidade
      throw new DeleteOperationError("Failed to delete document", error);
    } finally {
      deleteMutex.release();
    }
  }

  /**
   * Executes a query on the collection.
   *
   * The query is executed using a custom filter function that takes a document
   * as an argument and returns a boolean indicating whether the document should
   * be included in the result set.
   *
   * @param filter - The filter function to apply to the documents in the collection.
   * @param options - Optional parameters to control the query execution.
   * @param options.concurrent - Whether to execute the query concurrently.
   * @param options.batchSize - The number of documents to process in parallel.
   * @returns A promise that resolves to an array of documents that match the filter.
   */
  async query(
    filter: (doc: Document<Collections, K>) => boolean,
    options: {
      concurrent?: boolean;
      batchSize?: number;
    } = {}
  ) {
    const files = await readdir(this.#basePath, { withFileTypes: true });
    const jsonFiles = files
      .filter((file) => file.isFile() && file.name.endsWith(".json"))
      .map((file) => file.name);

    const results: Document<Collections, K>[] = [];
    for (let i = 0; i < jsonFiles.length; i += 100) {
      const batch = jsonFiles.slice(i, i + 100);
      const batchDocs = (await Promise.all(
        batch.map((name) => this.read(name.replace(".json", "")))
      )) as Document<Collections, K>[];

      results.push(...batchDocs.filter((d) => d && filter(d)));
    }

    return results;
  }
}
