import { rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Mutex } from "async-mutex";

interface QueueEntry {
  data: string;
  resolve: (value: true) => void;
  reject: (reason?: any) => void;
}

const TEMP_PREFIX = `.tmp_${process.pid}_`;

async function atomicRename(source: string, target: string, retries = 3) {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      lastError = error as Error;
      await new Promise((r) => setTimeout(r, 10 * 2 ** i));
    }
  }

  throw (
    lastError || new Error(`Failed to rename file after ${retries} attempts`)
  );
}

export default class Writer {
  #basePath: string;
  #queue = new Map<string, QueueEntry[]>();
  #active = new Set<string>();
  #mutex = new Mutex();
  #maxParallel: number;
  #tempCounter = 0;
  #tempBuffer = Buffer.allocUnsafe(16);

  /**
   * Constructs a new Writer instance.
   * @param basePath The path to the file to write to.
   */
  constructor(basePath: string, maxParallel = 100) {
    this.#basePath = basePath;
    this.#maxParallel = maxParallel;
  }

  #generateTempId(): string {
    this.#tempBuffer.writeBigUInt64BE(BigInt(Date.now()), 0);
    this.#tempBuffer.writeBigUInt64BE(BigInt(++this.#tempCounter), 8);
    return TEMP_PREFIX + this.#tempBuffer.toString("base64url");
  }

  async #performWrite(filename: string, data: string) {
    const tempFile = join(this.#basePath, this.#generateTempId());
    const targetFile = join(this.#basePath, `${filename}.json`);

    await Promise.all([writeFile(tempFile, data), this.#mutex.acquire()]);

    try {
      await atomicRename(tempFile, targetFile);
    } finally {
      this.#mutex.release();
      unlink(tempFile).catch(() => {});
    }
  }

  async #processQueue(fileName: string) {
    while (true) {
      const queue = this.#queue.get(fileName);
      if (!queue || queue.length === 0) {
        this.#active.delete(fileName);
        this.#queue.delete(fileName);
        return;
      }

      const entry = queue.shift()!;
      if (queue.length === 0) this.#queue.delete(fileName);

      try {
        await this.#performWrite(fileName, entry.data);
        entry.resolve(true);
      } catch (error) {
        entry.reject(error);
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
    return new Promise<boolean>((resolve, reject) => {
      const entry: QueueEntry = { data, resolve, reject };

      if (!this.#queue.has(fileName)) {
        this.#queue.set(fileName, []);
      }

      this.#queue.get(fileName)!.push(entry);

      if (!this.#active.has(fileName)) {
        this.#active.add(fileName);
        this.#processQueue(fileName).catch(reject);
      }
    });
  }
}
