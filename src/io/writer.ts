import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { retryAsyncOperation } from "../utils/utils.js";

interface FileState {
	locked: boolean;
	nextData: string | null;
	nextPromise: Promise<void> | null;
	nextResolve: (() => void) | null;
	nextReject: ((error: Error) => void) | null;
}

function randomString() {
	return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getTempPath(path: string) {
	return join(path, `$.tmp_${randomString()}`);
}

function getFilePath(basePath: string, fileName: string) {
	return join(basePath, `${fileName}.json`);
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
		const queue = this.#queue;

		// biome-ignore lint/style/noNonNullAssertion: ignored for now
		const state = queue.get(filename)!;
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
			if (state.nextData !== null) {
				const nextData = state.nextData;
				state.nextData = null;
				await this.write(filename, nextData);
			} else {
				state.nextPromise = null;
				state.nextResolve = null;
				state.nextReject = null;
				queue.delete(filename);
			}
		}
	}

	/**
	 * Writes data to a file with the given filename.
	 *
	 * If the file is currently being written to, the data is queued to be written
	 * once the current write operation completes. Ensures that writes are
	 * performed atomically and handles concurrent write requests by queuing them.
	 *
	 * @param fileName - The name of the file to write to.
	 * @param data - The data to be written to the file.
	 * @returns A promise that resolves to true when the write operation is complete.
	 */
	async write(fileName: string, data: string) {
		const queue = this.#queue;

		if (!queue.has(fileName)) {
			queue.set(fileName, {
				locked: false,
				nextData: null,
				nextPromise: null,
				nextResolve: null,
				nextReject: null,
			});
		}

		const state = queue.get(fileName);

		if (!state) {
			throw new Error(`File state not found for ${fileName}`);
		}

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
