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
import {
  DeleteOperationError,
  DocumentNotFoundError,
  QueryOperationError,
} from "../core/errors.js";
import Writer from "../io/writer.js";
import type {
  CollectionMetadata,
  CollectionOptions,
  ConcurrencyStrategy,
  Document,
  ValidationFunction
} from "../types/index.js";
import AsyncMutex from "../utils/mutex.js";
import Cache from "./cache.js";
import Metadata from "./metadata.js";

export default class Collection<
  Collections,
  K extends keyof Collections
> {
  #basePath: string;
  #schema: ValidationFunction<Document<Collections, K>>;
  #concurrencyStrategy: ConcurrencyStrategy;
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
    this.#concurrencyStrategy = options.concurrencyStrategy || "optimistic";

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
    try {
      await access(this.#basePath);
      return;
    } catch {
      try {
        await mkdir(this.#basePath, { recursive: true });
        await this.#metadata?.saveMetadata();
      } catch (error) {
        console.error("Failed to create collection directory", {
          path: this.#basePath,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new Error(
          `Failed to create collection directory: ${this.#basePath}`
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
  private getDocumentPath(id: string): string {
    return path.join(this.#basePath, `${id}.json`);
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
    } catch { }
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
  async create(data: Omit<Document<Collections, K>, 'id'>) {
    try {
      
    // Parallel promise execution
    await Promise.all([
      this.ensureCollectionExists(),
      this.#metadata?.loadMetadata(),
    ]);

    const id = (data as Document<Collections, K>).id ?? crypto.randomUUID();
    const document = { ...data, id } as Document<Collections, K>;

    if (!this.#schema(document)) {
      throw new Error("Document failed schema validation");
    }

    const documentMetadata = {
      ...this.#metadata,
      documentCount: (this.#metadata?.documentCount || 0) + 1,
      lastModified: Date.now(),
    };

    await Promise.all([
      this.#writer.write(id, JSON.stringify(document)),
      this.#metadata?.saveMetadata(documentMetadata),
    ]);

    this.#cache.update(id, document);

    return document;

    } catch (error) {
      console.dir('error',this.#writer.status);

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
    if (
      cached?._lastModified &&
      Date.now() - cached._lastModified < this.#cache.timeout
    ) {
      return cached;
    }

    try {
      const documentPath = this.getDocumentPath(id);
      const data = await readFile(documentPath, "utf-8");
      const document = JSON.parse(data) as Document<Collections, K>;

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
    await this.ensureCollectionExists();

    const files = await readdir(this.#basePath);

    const documentFiles = files.filter(
      (file) => file.endsWith(".json") && !file.startsWith("_")
    );

    let results: Document<Collections, K>[] = [];

    await Promise.all(
      documentFiles.map(async (file) => {
        const id = file.replace(".json", "");
        const doc = await this.read(id);
        if (doc !== null) {
          results.push(doc);
        }
      })
    );

    if (options?.skip) {
      results = results.slice(options.skip);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
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
  async update(id: string, data: Partial<Omit<Document<Collections, K>, "id">>) {
    if (this.#concurrencyStrategy === "optimistic") {
      const lockId = await this.acquireLock(id);
      if (!lockId) {
        throw new Error("Failed to acquire lock");
      }

      try {
        const result = await this.#_update(id, data);
        await this.releaseLock(id, lockId);
        return result;
      } catch (error) {
        await this.releaseLock(id, lockId);
        throw error;
      }
    } else {
      return this.#_update(id, data);
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
  async #_update(
    id: string,
    data: Partial<Omit<Document<Collections, K>, "id">>
  ) {
    const current = await this.read(id);
    if (!current) return null;
    if (
      this.#concurrencyStrategy === "versioning" &&
      data._version !== undefined &&
      data._version !== current._version
    ) {
      throw new Error(
        "Version mismatch. The document was modified by another process"
      );
    }

    const updated = {
      ...current,
      ...data,
      id: current.id,
      _version:
        this.#concurrencyStrategy === "versioning"
          ? (current._version || 0) + 1
          : undefined,
      _lastModified: Date.now(),
    } as Document<Collections, K>;

    if (!this.#schema(updated)) {
      throw new Error("Document failed schema validation");
    }

    const documentPath = this.getDocumentPath(id);
    await writeFile(documentPath, JSON.stringify(updated, null, 2));
    await this.#metadata?.saveMetadata();
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
    const deleteMutex = new AsyncMutex();

    try {
      deleteMutex.lock();

      const documentPath = this.getDocumentPath(id);

      // Operações concorrentes otimizadas
      const [documentExists] = await Promise.allSettled([
        access(documentPath),
        this.#cache.get(id), // Verifica se o documento existe na cache
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

      const updatedMetadata: Partial<CollectionMetadata> = {
        documentCount: (this.#metadata?.documentCount || 0) - 1,
        lastModified: Date.now(),
      };

      await Promise.all([
        this.#metadata?.saveMetadata(updatedMetadata),
        this.#cache.delete(id),
      ]);

      return true;
    } catch (error) {
      // Erro customizado para melhor rastreabilidade
      throw new DeleteOperationError("Failed to delete document", error);
    } finally {
      deleteMutex.unlock();
    }
  }

  /**
   * Queries the collection for documents matching the given filter function.
   *
   * @param filter - A function that takes a document as an argument and returns a boolean indicating whether the document matches the query.
   * @returns A promise that resolves to an array of documents that matched the query.
   */
  async query(
    filter: (doc: Document<Collections, K>) => boolean,
    options: {
      concurrent?: boolean;
      batchSize?: number;
      timeout?: number;
    } = {}
  ) {
    const {
      concurrent = true,
      batchSize = 50,
      timeout = 5000, // 5 segundos timeout global
    } = options;

    const queryMutex = new AsyncMutex();

    try {
      await queryMutex.lock();

      const files = await readdir(this.#basePath, { withFileTypes: true });
      const jsonFiles = files
        .filter(
          (file) =>
            file.isFile() &&
            file.name.endsWith(".json") &&
            !file.name.startsWith("_")
        )
        .map((file) => file.name);

      const results: Document<Collections, K>[] = [];

      if (concurrent) {
        const processFileBatch = async (batch: string[]) => {
          const batchResults = await Promise.all(
            batch.map(async (filename) => {
              try {
                const filePath = path.join(this.#basePath, filename);
                const documentData = await Promise.race([
                  readFile(filePath, "utf-8"),
                  new Promise<void>((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Read operation timeout")),
                      timeout
                    )
                  ),
                ]);

                const doc = JSON.parse(documentData as string) as Document<Collections, K>;
                return filter(doc) ? doc : null;
              } catch (error) {
                console.error(`Error processing file ${filename}:`, error);
                return null;
              }
            })
          );

          return batchResults.filter(Boolean) as Document<Collections, K>[];
        };

        for (let i = 0; i < jsonFiles.length; i += batchSize) {
          const batch = jsonFiles.slice(i, i + batchSize);
          const batchResults = await processFileBatch(batch);
          results.push(...batchResults);
        }
      } else {
        // Sequencial processing for no concurrency scenario
        for (const fileName of jsonFiles) {
          try {
            const documentPath = path.join(this.#basePath, fileName);
            const documentData = await readFile(documentPath, "utf-8");
            const doc = JSON.parse(documentData) as Document<Collections, K>;

            if (filter(doc)) {
              results.push(doc);
            }
          } catch (error) {
            console.error(`Error processing file ${fileName}:`, error);
          }
        }
      }

      return results;
    } catch (error) {
      console.error("Query operation failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw new QueryOperationError("Failed to execute query", error);
    } finally {
      queryMutex.unlock();
    }
  }
}
