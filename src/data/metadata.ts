import { parse, stringify } from "devalue";
import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { MetadataPersistenceError } from "../core/errors.js";
import Writer from "../io/writer.js";
import type { CollectionMetadata } from "../types/index.js";

const MAX_METADATA_SIZE = 1024 * 10;
const METADATA_PARSE_TIMEOUT = 500;

export default class Metadata {
  #metadataPath: string;
  #metadata: CollectionMetadata;
  #writer: Writer;

  constructor(path: string) {
    this.#metadataPath = join(path, "_metadata.json");
    this.#writer = new Writer(path);
    this.#metadata = this.#initializeMetadata(path);
  }

  get documentCount(): number {
    return this.#metadata.documentCount;
  }

  get indexes(): string[] {
    return this.#metadata.indexes;
  }

  async incrementDocumentCount(amount = 1) {
    this.#metadata.documentCount += amount;
    await this.#persist({ documentCount: this.#metadata.documentCount });
  }

  async decrementDocumentCount(amount = 1) {
    this.#metadata.documentCount -= amount;
    await this.#persist({ documentCount: this.#metadata.documentCount });
  }

  async addIndex(indexName: string) {
    if (!this.#metadata.indexes.includes(indexName)) {
      this.#metadata.indexes.push(indexName);
      await this.#persist({ indexes: this.#metadata.indexes });
    }
  }

  async updateLastModified(): Promise<void> {
    await this.#persist({ lastModified: Date.now() });
  }

  async #validateMetadata(data: unknown) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid metadata structure");
    }

    const metadata = data as CollectionMetadata;

    if (
      typeof metadata.documentCount !== "number" ||
      metadata.documentCount < 0
    ) {
      throw new Error("Invalid document count");
    }

    if (!Array.isArray(metadata.indexes)) {
      throw new Error("Invalid indexes format");
    }

    return metadata;
  }

  async #persist(update: Partial<CollectionMetadata>) {
    try {
      const newMetadata = {
        ...this.#metadata,
        ...update,
        lastModified: Date.now(),
      } satisfies Partial<CollectionMetadata>;

      await this.#writer.write('_metadata', stringify(newMetadata));
    } catch (error) {
      throw new MetadataPersistenceError(
        `Failed to save metadata:  ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error as Error
      );
    }
  }

  /**
   * Initializes the collection metadata with the given name and options.
   *
   * If the options include generateMetadata, the collection metadata will be
   * initialized with an empty object. Otherwise, it will be initialized with
   * the default collection metadata.
   *
   * @param name - The name of the collection.
   * @param generateMetadata - Whether to initialize the collection metadata
   * with an empty object. Defaults to false.
   * @returns The initialized collection metadata.
   */
  #initializeMetadata(name: string): CollectionMetadata {
    return {
      name: basename(name, ".json"),
      documentCount: 0,
      indexes: [],
      lastModified: Date.now(),
    };
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
  async load(): Promise<void> {
    try {
      const [stats, data] = await Promise.all([
        stat(this.#metadataPath),
        readFile(this.#metadataPath, "utf-8"),
        // new Promise((_, reject) =>
        //   setTimeout(
        //     () => reject(new Error("Metadata load timeout")),
        //     METADATA_PARSE_TIMEOUT
        //   )
        // ),
      ]);

      if (stats.size > MAX_METADATA_SIZE) {
        throw new Error("Metadata file is too large");
      }

      const parsed = parse(data);
      const validated = await this.#validateMetadata(parsed);

      this.#metadata = {
        ...this.#initializeMetadata(this.#metadata.name),
        ...validated,
      };
    } catch (error) {
      await this.#persist(this.#metadata);
    }
  }
}
