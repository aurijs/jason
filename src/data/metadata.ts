import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import AsyncMutex from "../utils/mutex.js";
import type { CollectionMetadata } from "../types/index.js";
import { MetadataPersistenceError } from "../core/errors.js";
export default class Metadata {
  #metadataPath: string;
  #metadata!: CollectionMetadata;

  constructor(path: string) {
    this.#metadataPath = join(path, "_metadata.json");

    this.#initializeMetadata(path);
  }

  get documentCount(): number {
    return this.#metadata.documentCount;
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
  #initializeMetadata(
    name: string,
    generateMetadata?: boolean
  ): CollectionMetadata {
    if (generateMetadata) {
      return {} as CollectionMetadata;
    }

    return {
      name,
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
  async loadMetadata(): Promise<void> {
    const metadataLoadMuxex = new AsyncMutex();
    try {
      metadataLoadMuxex.lock();

      const filestats = await stat(this.#metadataPath);

      // Proteção contra arquivos de metadados muito grandes
      if (filestats.size > 1024 * 10) {
        // 10KB
        throw new Error("Metadata file is too large");
      }

      const data = await Promise.race([
        readFile(this.#metadataPath, "utf-8"),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Metadata read timeout")), 500)
        ),
      ]);

      // Validação estrutural segura do metadata
      try {
        const parsedMetadata = JSON.parse(data as string);

        // Validação estrutural básica
        if (!parsedMetadata || typeof parsedMetadata !== "object") {
          throw new Error("Invalid metadata structure");
        }

        this.#metadata = {
          name: parsedMetadata.name || this.#metadata.name,
          documentCount: parsedMetadata.documentCount || 0,
          indexes: parsedMetadata.indexes || [],
          lastModified: parsedMetadata.lastModified || Date.now(),
        };
      } catch (parseError) {
        // Tratamento de erro de parsing
        console.warn("Metadata parsing error, reinitializing", parseError);
        await this.saveMetadata();
      }
    } catch (error) {
      console.error("Metadata load failed", {
        path: this.#metadataPath,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Fallback para metadata padrão
      this.#metadata = {
        name: basename(this.#metadataPath),
        documentCount: 0,
        indexes: [],
        lastModified: Date.now(),
      };

      await this.saveMetadata();
    } finally {
      metadataLoadMuxex.unlock();
    }
  }

  /**
   * Saves the collection metadata to the file system.
   *
   * Serializes the metadata to JSON and writes it to the metadata file.
   *
   * @returns A promise that resolves when the metadata is saved.
   */
  async saveMetadata(metadata?: Partial<CollectionMetadata>): Promise<void> {
    const updateMutex = new AsyncMutex();
    try {
      updateMutex.lock();

      const updatedMetadata: CollectionMetadata = {
        ...this.#metadata,
        ...metadata,
        lastModified: Date.now(),
      };

      const metadataContent = JSON.stringify(updatedMetadata, null, 0);

      await writeFile(this.#metadataPath, metadataContent, {
        flag: "w", // Modo de escrita
        mode: 0o666, // Permisoes de escrita
      });

      this.#metadata = updatedMetadata;
    } catch (error: Error | any) {
      console.error("Metadata Persistence Error:", {
        path: this.#metadataPath,
        errorCode: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      });

      throw new MetadataPersistenceError("Failed to save metadata", error);
    } finally {
      updateMutex.unlock();
    }
  }
}
