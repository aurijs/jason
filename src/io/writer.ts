import type { PathLike } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { batch, derived, effect, state } from "../reactive/index.js";
import { retryAsyncOperation } from "../utils/utils.js";

interface WriteOperation {
	data: string;
	timestamp: number;
	retries: number;
}

interface WriterState {
	locked: boolean;
	pendingWrites: Map<string, WriteOperation>;
	currentFile: string | null;
	error: Error | null;
}

export default class Writer {
	readonly #basePath: string;

	readonly #state = state<WriterState>({
		locked: false,
		pendingWrites: new Map(),
		currentFile: null as string | null,
		error: null as Error | null,
	});

	#status = derived(() => ({
		isLocked: this.#state.locked,
		hasPending: this.#state.pendingWrites.size > 0,
		currentOperation: this.#getCurrentOperation(),
	}));

	/**
	 * Constructs a new Writer instance.
	 * @param basePath The path to the file to write to.
	 */
	constructor(basePath: string) {
		this.#basePath = basePath;

		// Effect to handle pending writes
		effect(() => {
			if (
				!this.#status.isLocked &&
				this.#status.hasPending &&
				this.#status.currentOperation
			) {
				const { filename, operation } = this.#status.currentOperation;

				batch(() => {
					// Remove the current operation from the queue
					const newPendingWrites = new Map(this.#state.pendingWrites);
					newPendingWrites.delete(filename);
					this.#state.pendingWrites = newPendingWrites;

					// Set current file and initiate write
					this.#state.currentFile = filename;
					this.#write(filename, operation.data).catch((error) => {
						console.error(`Error writing to file: ${filename}`, error);

						if (operation.retries < 3) {
							const newPendingWrites = new Map(this.#state.pendingWrites);
							newPendingWrites.set(filename, {
								...operation,
								retries: operation.retries + 1,
								timestamp: Date.now(),
							});

							this.#state.pendingWrites = newPendingWrites;
						}
					});
				});
			}
		});
	}

	#getCurrentOperation() {
		if (this.#state.pendingWrites.size === 0) return null;
		let earliestTimestamp = Number.POSITIVE_INFINITY;
		let selectedFilename: string | null = null;
		let selectedOperation: WriteOperation | null = null;

		for (const [filename, operation] of this.#state.pendingWrites.entries()) {
			if (operation.timestamp < earliestTimestamp) {
				earliestTimestamp = operation.timestamp;
				selectedFilename = filename;
				selectedOperation = operation;
			}
		}

		return selectedFilename && selectedOperation
			? { filename: selectedFilename, operation: selectedOperation }
			: null;
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

		// Use a random UUID to avoid race conditions
		const randomPart = crypto.randomUUID();

		return join(this.#basePath, `.${Date.now()}-${randomPart}.tmp`);
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

			await writeFile(temporaryFilename, data, {
				encoding: "utf-8",
				flag: "wx",
			});
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
		if (this.#status.isLocked) {
			const newPendingWrites = new Map(this.#state.pendingWrites);
			newPendingWrites.set(fileName, {
				data,
				timestamp: Date.now(),
				retries: 0,
			});

			this.#state.pendingWrites = newPendingWrites;
			return;
		}
		return this.#write(fileName, data);
	}

	get status() {
		return {
			isLocked: this.#status.isLocked,
			hasPending: this.#status.hasPending,
			currentFile: this.#state.currentFile,
			pendingCount: this.#state.pendingWrites.size,
		};
	}
}
