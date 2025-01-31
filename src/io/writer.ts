import { rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface FileState {
  locked: boolean;
  nextData: string | null;
  nextPromise: Promise<void> | null;
  nextResolve: (() => void) | null;
  nextReject: ((error: Error) => void) | null;
}

const TEMP_PREFIX = `.tmp_${process.pid}_`;

function getTempPath(path: string) {
  return join(path, `${TEMP_PREFIX}_${crypto.randomUUID()}`);
}

function getFilePath(basePath: string, fileName: string) {
  return join(basePath, `${fileName}.json`);
}

async function retryAsyncOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 10
): Promise<T> {
  return operation().catch(async (error: Error) => {
    if (maxRetries <= 0) throw error;
    await new Promise((r) => setTimeout(r, baseDelay));
    return retryAsyncOperation(operation, maxRetries - 1, baseDelay * 2);
  });
}

export default class Writer {
  #basePath: string;
  #queue = new Map<string, FileState>();

  /**
   * Constructs a new Writer instance.
   * @param basePath The path to the file to write to.
   */
  constructor(basePath: string) {
    this.#basePath = basePath;
  }

  async #atomicWrite(tempPath: string, filePath: string, data: string) {
    await writeFile(tempPath, data, "utf-8");
    await retryAsyncOperation(() => rename(tempPath, filePath));
  }

  async #write(filename: string, data: string) {
    const state = this.#queue.get(filename)!;
    state.locked = true;

    const filePath = getFilePath(this.#basePath, filename);
    const tempPath = getTempPath(this.#basePath);

    try {
      await this.#atomicWrite(tempPath, filePath, data);
      state.nextResolve?.();
      return true;
    } catch (error) {
      state.nextReject?.(error as Error);
      throw error;
    } finally {
      state.locked = false;
      await unlink(tempPath).catch(() => {});
      if (state.nextData !== null) {
        const nextData = state.nextData;
        state.nextData = null;
        await this.write(filename, nextData);
      } else {
        state.nextPromise = null;
        state.nextResolve = null;
        state.nextReject = null;
        this.#queue.delete(filename);
      }
    }
  }

  /**
   * Writes data to a file.
   *
   * If the file is currently being written to, it will buffer the data and write it when the file is available.
   * If the file is not currently being written to, it will write the data immediately.
   *
   * @param filename - The name of the file to write to.
   * @param data - The data to be written.
   * @returns A promise that resolves when the data has been written.
   */
  async write(fileName: string, data: string) {
    if (!this.#queue.has(fileName)) {
      this.#queue.set(fileName, {
        locked: false,
        nextData: null,
        nextPromise: null,
        nextResolve: null,
        nextReject: null,
      });
    }

    const state = this.#queue.get(fileName)!;

    if (!state.locked) {
      return this.#write(fileName, data);
    }

    if (state.nextPromise) {
      state.nextData = data;
      return new Promise<boolean>((resolve, reject) => {
        state.nextPromise?.then(() => resolve(true)).catch(reject);
      });
    }

    state.nextData = data;
    state.nextPromise = new Promise<void>((resolve, reject) => {
      state.nextResolve = resolve;
      state.nextReject = reject;
    });

    return new Promise<boolean>((resolve, reject) => {
      state.nextPromise?.then(() => resolve(true)).catch(reject);
    });
  }
}
