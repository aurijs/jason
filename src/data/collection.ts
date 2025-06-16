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
  IndexSchemaType,
  ParsedIndexDefinition,
} from "../types/index.js"; // Certifique-se que EvictionStrategy seja exportado de types/index.js ou importado de cache.ts
import Cache from "./cache.js";
import Metadata from "./metadata.js";

export default class Collection<Collections, K extends keyof Collections> {
  #basePath: string;
  #schema: ValidationFunction<Document<Collections, K>>;
  #metadata: Metadata | null;
  #cache: Cache<Document<Collections, K>>;
  #writer: Writer;
  #indicesOptionString?: string;
  #processedIndices: ParsedIndexDefinition[] = [];
  #primaryKeyConfig: {
    fieldName: string;
    type: "auto-increment-pk" | "uuid-pk";
  } | null = null;
  #isInitialized = false;

  /**
   * Constructs a new Collection.
   *
   * @param basePath - The base path where the collection data will be stored.
   * @param name - The name of the collection.
   * @param options - Options for the collection.
   * @param options.schema - The schema validation function for the collection.
   * @param options.indices - Optional string defining collection indices (e.g., "++id,&email,*tags").
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

    // Ensure 'id' is always indexed as a primary key (B-tree) if not explicitly defined
    const hasAnyIdIndex = options.indices
      ? options.indices
          .split(",")
          .map((s) => s.trim())
          .some(
            (part) =>
              part === "id" ||
              part === "++id" ||
              part === "@id" ||
              part === "&id"
          )
      : false;

    if (!hasAnyIdIndex) {
      if (options.indices) {
        this.#indicesOptionString = `id,${options.indices}`;
      } else {
        this.#indicesOptionString = `id`;
      }
    } else {
      this.#indicesOptionString = options.indices;
    }

    this.#metadata =
      options.generateMetadata !== false // Default to true if not specified
        ? new Metadata(this.#basePath)
        : null;

    this.#writer = new Writer(this.#basePath);

    this.#cache = new Cache<Document<Collections, K>>(
      options.cacheTimeout,
      undefined, // Deixa o Cache usar seu maxSize padrão se não especificado por CollectionOptions
      options.cacheEvictionStrategy // Passa a estratégia de evicção
    );

    // Deferring #ensureCollectionExists and index processing to #ensureInitialized
  }

  /**
   * Ensures that the collection is initialized (directory exists, metadata loaded, indices processed).
   * This method is called by public methods to lazily initialize the collection.
   */
  async #ensureInitialized(): Promise<void> {
    if (this.#isInitialized) {
      return;
    }
    await this.#initializeCollection();
    this.#isInitialized = true;
  }

  /**
   * Performs the actual initialization steps for the collection.
   */
  async #initializeCollection(): Promise<void> {
    await this.#ensureCollectionDirectoryExists();
    if (this.#metadata) {
      await this.#metadata.load();
    }

    if (this.#indicesOptionString) {
      const parsed = this.#parseIndexSpecificationFromString(
        this.#indicesOptionString
      );
      this.#processedIndices = parsed;

      for (const def of parsed) {
        // Determine primary key configuration (simplified: only 'id' field for now)
        if (
          (def.type === "auto-increment-pk" || def.type === "uuid-pk") &&
          def.fieldName === "id"
        ) {
          if (this.#primaryKeyConfig) {
            console.warn(
              `Multiple primary key definitions found for 'id'. Using the first one: ${
                this.#primaryKeyConfig.type
              } on ${this.#primaryKeyConfig.fieldName}`
            );
          } else {
            this.#primaryKeyConfig = {
              fieldName: def.fieldName,
              type: def.type,
            };
          }
        }
        // Register with metadata if it doesn't exist yet
        if (
          this.#metadata &&
          !this.#metadata.indexes.includes(def.originalSpec)
        ) {
          try {
            await this.#metadata.addIndex(def.originalSpec);
          } catch (error) {
            console.error(
              `Failed to register index '${def.originalSpec}' with metadata:`,
              error
            );
          }
        }
      }
    }
  }

  /**
   * Parses the index specification string (e.g., "++id, &email, *tags, [name+email], city")
   * into an array of ParsedIndexDefinition objects.
   * @param specString - The comma-separated string of index specifications.
   * @returns An array of parsed index definitions.
   */
  #parseIndexSpecificationFromString(
    specString: string
  ): ParsedIndexDefinition[] {
    const definitions: ParsedIndexDefinition[] = [];
    if (!specString || typeof specString !== "string") {
      return definitions;
    }

    const parts = specString
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const part of parts) {
      let type: IndexSchemaType | null = null;
      let fieldName = "";
      let fields: string[] | undefined;

      if (part.startsWith("++")) {
        type = "auto-increment-pk";
        fieldName = part.substring(2);
      } else if (part.startsWith("@")) {
        type = "uuid-pk";
        fieldName = part.substring(1);
      } else if (part.startsWith("&")) {
        type = "unique";
        fieldName = part.substring(1);
      } else if (part.startsWith("*")) {
        type = "multi-value";
        fieldName = part.substring(1);
      } else if (part.startsWith("[") && part.endsWith("]")) {
        type = "compound";
        const fieldList = part
          .substring(1, part.length - 1)
          .split("+")
          .map((f) => f.trim());
        if (fieldList.length > 0) {
          fieldName = fieldList.join("+"); // Or just the first field, or the whole string
          fields = fieldList;
        } else {
          console.warn(`Invalid compound index format: ${part}`);
          continue;
        }
      } else {
        type = "standard";
        fieldName = part;
      }

      if (type && fieldName) {
        definitions.push({ originalSpec: part, type, fieldName, fields });
      } else if (type && !fieldName && type !== "compound") {
        console.warn(
          `Invalid index specification (missing field name?): ${part}`
        );
      }
    }
    return definitions;
  }

  /**
   * Ensures the collection exists by creating the base path if it does not exist.
   *
   * If the base path does not exist, it is created recursively. Then, the collection
   * metadata is saved to initialize the collection.
   *
   * @returns A promise that resolves when the collection exists.
   */
  async #ensureCollectionDirectoryExists(): Promise<void> {
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
      await this.#ensureInitialized();

      // ID generation logic will be updated in a subsequent step based on this.#primaryKeyConfig
      // For now, it uses the existing logic.
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
    await this.#ensureInitialized();
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
    await this.#ensureInitialized();
    const files = (await readdir(this.#basePath, { withFileTypes: true }))
      .filter(
        (file) =>
          file.isFile() &&
          !file.name.startsWith("_") && // Ignore metadata/temp files
          file.name.endsWith(".json")
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
        })
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
    await this.#ensureInitialized();
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
    await this.#ensureInitialized();
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
   * Creates multiple documents in the collection in a batch operation.
   *
   * @param dataArray - An array of document data to be created.
   * @returns A promise that resolves to an object containing arrays of successfully created documents and errors encountered.
   */
  async batchCreate(dataArray: CollectionParam<Collections, K>[]): Promise<{
    created: Document<Collections, K>[];
    errors: { input: CollectionParam<Collections, K>; error: Error }[];
  }> {
    await this.#ensureInitialized();
    const results = {
      created: [] as Document<Collections, K>[],
      errors: [] as { input: CollectionParam<Collections, K>; error: Error }[],
    };

    const operations = dataArray.map(async (data) => {
      // ID generation logic similar to single create
      // This does not handle auto-increment for batch operations without a centralized counter.
      const id = (data as Document<Collections, K>).id ?? crypto.randomUUID();
      const document = { ...data, id } as Document<Collections, K>;

      if (!this.#schema(document)) {
        throw new Error("Document failed schema validation");
      }

      await this.#writer.write(this.#encodeId(id), stringify(document));
      this.#cache.update(id, document);
      return document;
    });

    const settledResults = await Promise.allSettled(operations);

    let successfulCreationsCount = 0;
    settledResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.created.push(result.value);
        successfulCreationsCount++;
      } else {
        results.errors.push({
          input: dataArray[index],
          error: result.reason,
        });
      }
    });

    if (successfulCreationsCount > 0 && this.#metadata) {
      await this.#metadata.incrementDocumentCount(successfulCreationsCount);
    }

    return results;
  }

  /**
   * Updates multiple documents in the collection in a batch operation.
   *
   * @param updatesArray - An array of objects, each containing the `id` of the document to update and the `data` (partial) to apply.
   * @returns A promise that resolves to an object containing arrays of successfully updated documents and errors encountered.
   *          If a document to update is not found, it will be included in the errors array.
   */
  async batchUpdate(
    updatesArray: {
      id: string;
      data: Partial<CollectionParam<Collections, K>>;
    }[]
  ): Promise<{
    updated: Document<Collections, K>[];
    errors: {
      input: { id: string; data: Partial<CollectionParam<Collections, K>> };
      error: Error;
    }[];
  }> {
    await this.#ensureInitialized();
    const results = {
      updated: [] as Document<Collections, K>[],
      errors: [] as {
        input: { id: string; data: Partial<CollectionParam<Collections, K>> };
        error: Error;
      }[],
    };

    const operations = updatesArray.map(async (updateItem) =>
      this.update(updateItem.id, updateItem.data)
    );

    const settledResults = await Promise.allSettled(operations);
    let successfulUpdatesCount = 0;

    settledResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (result.value) {
          // update returns null if document not found or on other errors before throwing
          results.updated.push(result.value);
          successfulUpdatesCount++;
        } else {
          // This case handles when `this.update` returns null (e.g., document not found)
          // but doesn't throw an error that Promise.allSettled would catch as 'rejected'.
          results.errors.push({
            input: updatesArray[index],
            error: new DocumentNotFoundError(
              `Document with id '${updatesArray[index].id}' not found for update.`
            ),
          });
        }
      } else {
        results.errors.push({
          input: updatesArray[index],
          error: result.reason,
        });
      }
    });

    if (successfulUpdatesCount > 0 && this.#metadata) {
      // updateLastModified is already called by individual update operations if successful.
      // No need to call it again here unless we optimize individual updates to not call it.
      // For now, this is fine.
    }

    return results;
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
    } = {}
  ) {
    await this.#ensureInitialized();
    const files = await readdir(this.#basePath, { withFileTypes: true });
    const allJsonFiles = files
      .filter(
        (file) =>
          file.isFile() &&
          !file.name.startsWith("_") && // Ignore metadata/temp files
          file.name.endsWith(".json")
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
          })
        )
      ).filter(Boolean) as Document<Collections, K>[]; // Filter nulls early

      // Apply user filter to the valid documents in the batch
      results.push(...batchDocs.filter(filter));

      // Early exit if limit (applied later) is already reached
      if (
        options.limit &&
        results.length >= (options.skip ?? 0) + options.limit
      ) {
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
      collection: this
    ) => void | Promise<void>
  ): Promise<void> {
    await this.#ensureInitialized();
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

  /**
   * Invalida entradas do cache nesta coleção com base em um predicado.
   * @param predicate Uma função que recebe um documento e seu id, e retorna true se a entrada do cache correspondente deve ser invalidada.
   * @returns O número de itens invalidados do cache.
   */
  async invalidateCacheWhere(
    predicate: (doc: Document<Collections, K>, id: string) => boolean
  ): Promise<number> {
    await this.#ensureInitialized(); // Garante que o objeto de cache exista
    // A asserção de tipo para 'doc' pode ser necessária dependendo da assinatura exata de invalidateWhere em Cache
    // e como Document<Collections, K> se relaciona com T em Cache<T>
    return this.#cache.invalidateWhere(
      predicate as (value: Document<Collections, K>, id: string) => boolean
    );
  }
}
