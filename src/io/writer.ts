import type { PathLike } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { retryAsyncOperation } from "../utils/utils.js";

type Resolve = () => void;
type Reject = (error: Error) => void;

export default class Writer {
  #basePath: string;
  #locked = false;

  #prev: [Resolve, Reject] | null = null;
  #next: [Resolve, Reject] | null = null;
  #nextPromise: Promise<void> | null = null;
  #nextData: string | null = null;

  /**
   * Constructs a new Writer instance.
   * @param basePath The path to the file to write to.
   */
  constructor(basePath: string) {
    this.#basePath = basePath;
  }

  /**
   * Generates a temporary filename from the given filename.
   * The temporary filename is in the same directory as the given filename
   * and has the same extension, but with a random UUID and timestamp
   * inserted before the extension.
   * @param filename The path to the file to write to.
   * @returns A temporary filename.
   */
  #generateTemporaryFilename(filename: PathLike): string {
    const path =
      filename instanceof URL ? fileURLToPath(filename) : filename.toString();

    const dir = this.#basePath;

    // Use a random UUID to avoid race conditions
    const randomPart = crypto.randomUUID();

    return join(dir, `.${Date.now()}-${randomPart}.tmp`);
  }

  /**
   * Adds data to be written to the file.
   *
   * Stores the most recent data to be written and creates a promise
   * that resolves when the data is successfully written. Subsequent
   * calls to this method will replace the data to be written with the
   * new data, and return a promise that resolves when the current data
   * is written.
   *
   * @param data - The data to be written to the file.
   * @returns A promise that resolves when the data has been written.
   */
  #add(data: string): Promise<true> {
    // Only keep most recent data
    this.#nextData = data;

    // Create a singleton promise to resolve all next promises once next data is written
    this.#nextPromise ||= new Promise((resolve, reject) => {
      this.#next = [resolve, reject];
    });

    // Return a promise that will resolve at the same time as next promise
    return new Promise((resolve, reject) => {
      this.#nextPromise?.then(() => resolve(true)).catch(reject);
    });
  }

  /**
   * Writes data to the file.
   *
   * This method is atomic; it will overwrite the entire file with the
   * provided data. If the write fails, the original file will be left
   * intact.
   *
   * This method is also asynchronous and will not block other operations.
   * You can call this method multiple times in a row; each call will
   * queue up the data to be written and return a promise that resolves
   * when the data has been written.
   *
   * @param data - The data to be written to the file.
   * @returns A promise that resolves when the data has been written.
   */
  async #write(fileName: string, data: string): Promise<true> {
    // Lock file
    this.#locked = true;

    const fullPath = join(this.#basePath, `${fileName}.json`);
    const temporaryFilename = this.#generateTemporaryFilename(fileName);

    try {
      // Atomic write
      await writeFile(temporaryFilename, data, "utf-8");
      await retryAsyncOperation(async () => {
        await rename(temporaryFilename, fullPath);
      }, 10);

      // Call resolve
      this.#prev?.[0]();

      return true;
    } catch (err) {
      // Call reject
      if (err instanceof Error) {
        this.#prev?.[1](err);
      }
      throw err;
    } finally {
      // Unlock file
      this.#locked = false;

      this.#prev = this.#next;
      this.#next = this.#nextPromise = null;

      if (this.#nextData !== null) {
        const nextData = this.#nextData;
        this.#nextData = null;
        await this.write(fileName, nextData);
      }
    }
  }

  /**
   * Writes data to a file.
   *
   * If the file is currently being written to, it will buffer the data and write it when the file is available.
   * If the file is not currently being written to, it will write the data immediately.
   *
   * @param fileName - The name of the file to write to.
   * @param data - The data to be written.
   * @returns A promise that resolves when the data has been written.
   */
  write(fileName: string, data: string) {
    if (this.#locked) return this.#add(data);
    return this.#write(fileName, data);
  }
}