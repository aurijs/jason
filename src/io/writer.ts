import type { PathLike } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { retryAsyncOperation } from "../utils/utils.js";
import { derived, state, batch, effect } from '../reactive/index.js'

type Resolve = () => void;
type Reject = (error: Error) => void;

interface WriterState {
  locked: boolean;
  pendingWrites: [string, string][];
  currentFile: string | null;
  error: Error | null;
}

export default class Writer {
  #basePath: string;

  #state = state<WriterState>({
    locked: false,
    pendingWrites: [],
    currentFile: null as string | null,
    error: null as Error | null
  });

  #status = derived(() => ({
    isLoked: this.#state.locked,
    hasPending: this.#state.pendingWrites.length > 0,
  }));

  /**
   * Constructs a new Writer instance.
   * @param basePath The path to the file to write to.
   */
  constructor(basePath: string) {
    this.#basePath = basePath;

    // Effect to handle pending writes
    effect(() => {
      if (!this.#state.locked && this.#state.pendingWrites.length > 0) {
        // Get first pending write
        const [fileName, data] = this.#state.pendingWrites[0];

        batch(() => {
          // Remove first item from pending writes
          this.#state.pendingWrites = this.#state.pendingWrites.slice(1);
          this.#state.currentFile = fileName;
          this.#write(fileName, data);
        });
      }
    });
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
    this.#state.locked = true;

    try {
      const fullPath = join(this.#basePath, `${fileName}.json`);
      const temporaryFilename = this.#generateTemporaryFilename(fileName);

      await writeFile(temporaryFilename, data, { encoding: "utf-8", flag: 'wx' });
      await retryAsyncOperation(() => rename(temporaryFilename, fullPath), 10);

      return true;
    } catch (err) {
      if (err instanceof Error) {
        this.#state.error = err;
      }
      throw err;
    } finally {
      batch(() => {
        this.#state.locked = false;
        this.#state.currentFile = null;
      });
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
    if (this.#status.value.isLoked) {
      this.#state.pendingWrites.push([fileName, data]);
      return;
    }
    return this.#write(fileName, data);
  }
}
