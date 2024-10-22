import fs, { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {
	Index,
	Migration,
	Plugin,
	QueryOptions,
	ValidationFunction,
	QueryOptionsPartial,
	BaseDocument,
	ConcurrencyStrategy,
	LockInfo,
} from "./type";
import Cache from "./cache";

export default class JasonDB<T extends BaseDocument> {
	#filePath: string;
	private lockFilePath: string;
	private schema: ValidationFunction<T>;
	private plugins: Plugin<T>[] = [];
	private indexes: Index<T>[] = [];
	private cache = new Cache();
	private migrations: Migration[] = [];
	private currentVersion = 0;
	private concurrencyStrategy: ConcurrencyStrategy;
	private lockTimeout = 30000; // 30 seconds

	constructor(
		fileName: string,
		options: {
			initialData?: T[];
			schema?: ValidationFunction<T>;
			concurrencyStrategy?: ConcurrencyStrategy;
		} = {},
	) {
		this.#filePath = path.join(process.cwd(), `${fileName}.json`);
		this.lockFilePath = path.join(process.cwd(), `${fileName}.lock`);
		this.schema = options.schema || (() => true);
		this.concurrencyStrategy = options.concurrencyStrategy || "optimistic";

		if (options.initialData) {
			this.initializeData(options.initialData);
		}
	}

	get filePath() {
		return this.#filePath;
	}

	/**
	 * Attempts to acquire a lock on the database by creating a lock file.
	 *
	 * Generates a unique lock ID and writes a lock file with a timestamp and expiration.
	 * If a valid lock already exists, it returns null.
	 *
	 * @returns A promise that resolves to the lock ID if the lock is successfully acquired, or null if it fails.
	 */
	private async acquireLock(): Promise<string | null> {
		try {
			const lockId = crypto.randomBytes(16).toString("hex");
			const lock: LockInfo = {
				id: lockId,
				timestamp: Date.now(),
				expiresAt: Date.now() + this.lockTimeout,
			};

			// check if lock already exists
			try {
				const existingLock = await readFile(this.lockFilePath, "utf-8");
				const lockInfo: LockInfo = JSON.parse(existingLock);

				if (lockInfo.expiresAt > Date.now()) {
					return null;
				}
			} catch {
				/* continue if lock doesn't exist */
			}

			// write new lock
			await writeFile(this.lockFilePath, JSON.stringify(lock));
			return lockId;
		} catch {
			return null;
		}
	}

	/**
	 * Releases a lock on the database by deleting the lock file.
	 *
	 * Checks the lock ID against the one stored in the lock file and if they match, it deletes the lock file.
	 * If the lock ID does not match, it does not delete the file.
	 *
	 * @param lockId - The lock ID to match against the one stored in the lock file.
	 * @returns A promise that resolves to true if the lock was successfully released, or false if it failed.
	 */
	private async releaseLock(lockId: string): Promise<boolean> {
		try {
			const existingLock = await readFile(this.lockFilePath, "utf-8");
			const lockInfo: LockInfo = JSON.parse(existingLock);
			if (lockInfo.id === lockId) {
				await unlink(this.lockFilePath);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Handles concurrency by acquiring a lock before performing an operation and releasing it afterwards.
	 *
	 * If the lock can't be acquired after a certain number of retries, it throws an error.
	 *
	 * @param operation - The operation to be performed.
	 * @param retries - The number of retries to acquire the lock before throwing an error.
	 * @returns The result of the operation or undefined if it failed after maximum retries.
	 */
	private async handleConcurrency<R>(
		operation: () => Promise<R>,
		retries = 3,
	): Promise<R | undefined> {
		if (this.concurrencyStrategy === "none") {
			return operation();
		}

		let attempts = 0;
		while (attempts < retries) {
			const lockId = await this.acquireLock();
			if (!lockId) {
				attempts++;
				if (attempts === retries)
					throw new Error("Failed to acquire lock after maximum retries");

				await new Promise((resolve) =>
					setTimeout(resolve, 1000 * Math.random()),
				);
			} else {
				try {
					const result = await operation();
					await this.releaseLock(lockId);
					return result;
				} catch (error) {
					await this.releaseLock(lockId);
					throw error;
				}
			}
		}

		throw new Error("Failed to execute operation after maximum retries");
	}

	/**
	 * Checks if the version of the item being saved is greater than the one stored.
	 *
	 * If the concurrency strategy is not "versioning", it returns true.
	 * If the stored item is null, it returns true.
	 * Otherwise, it compares the version numbers and returns true if the one being saved is greater.
	 *
	 * @param item - The item being saved.
	 * @param storedItem - The item as it is currently stored.
	 * @returns A promise that resolves to true if the version is valid, or false if it is not.
	 */
	private async checkVersion(item: T, storedItem: T | null): Promise<boolean> {
		if (this.concurrencyStrategy !== "versioning") return true;
		if (!storedItem) return true;
		return (item._version ?? 0) > (storedItem._version ?? 0);
	}

	private async initializeData(initialData: T[]): Promise<void> {
		try {
			await fs.access(this.#filePath);
		} catch {
			await this.writeFile(initialData);
		}
	}

	private async readFile(): Promise<T[]> {
		try {
			const data = await readFile(this.#filePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				await this.writeFile([]);
				return [];
			}
			throw error;
		}
	}

	private async writeFile(data: T[]): Promise<void> {
		await fs.writeFile(this.#filePath, JSON.stringify(data, null, 2));
	}

	/**
	 * Creates a new item in the database.
	 *
	 * Validates the item against the schema and assigns versioning metadata
	 * if the concurrency strategy is "versioning". The item is then added
	 * to the database, indexes are updated, and the item is cached.
	 *
	 * @param item - The item to be created in the database.
	 * @returns A promise that resolves to the created item.
	 * @throws An error if the item does not pass the schema validation.
	 */
	async create(item: T): Promise<T> {
		if (!this.schema(item)) {
			throw new Error("Invalid item schema");
		}
		const data = await this.readFile();

		if (this.concurrencyStrategy === "versioning") {
			item._version = 1;
			item._lastModified = Date.now();
		}

		data.push(item);
		await this.writeFile(data);
		this.updateIndexes(item);
		this.cache.updateCache(item);
		return item;
	}

	async read(id: string) {
		const cachedItem = this.cache.getFromCache(id);
		if (cachedItem) return cachedItem;

		const data = await this.readFile();
		const item = data.find((item) => item.id === id) || null;
		if (item) this.cache.updateCache(item);
		return item;
	}

	/**
	 * Updates an existing item in the database.
	 *
	 * Checks if the item has been modified since the last read by comparing
	 * the version number. If the version number has changed, it throws an
	 * error.
	 *
	 * @param id - The id of the item to be updated.
	 * @param updatedItem - The partial item with the updated data.
	 * @returns A promise that resolves to the updated item or undefined/null if
	 * the item does not exist.
	 * @throws An error if the item does not pass the schema validation or if the
	 * version number has changed.
	 */
	async update(
		id: string,
		updatedItem: Partial<T>,
	): Promise<T | undefined | null> {
		return this.handleConcurrency(async () => {
			const data = await this.readFile();
			const index = data.findIndex((item) => item.id === id);
			if (index === -1) return null;

			const currentItem = data[index];

			// Check if the version is valid
			if (!(await this.checkVersion(updatedItem as T, currentItem))) {
				throw new Error(
					"Version mismatch. The document was modified by another process",
				);
			}

			const newItem = { ...currentItem, ...updatedItem } as T;

			// Update versioning info
			if (this.concurrencyStrategy === "versioning") {
				newItem._version = (currentItem._version ?? 0) + 1;
				newItem._lastModified = Date.now();
			}

			if (!this.schema(newItem)) {
				throw new Error("Invalid item schema");
			}

			data[index] = newItem;
			await this.writeFile(data);
			this.updateIndexes(newItem);
			this.cache.updateCache(newItem);
			return newItem;
		});
	}

	async delete(id: string) {
		const data = await this.readFile();
		const initialLength = data.length;
		const newData = data.filter((item) => item.id !== id);
		await this.writeFile(newData);
		this.removeFromIndexes(id);
		this.cache.removeFromCache(id);
		return newData.length < initialLength;
	}

	addPlugin(plugin: Plugin<T>): void {
		this.plugins.push(plugin);
		plugin(this);
	}

	addIndex(field: keyof T): void {
		this.indexes.push({ field, values: new Map() });
		this.rebuildIndex(field);
	}

	private async rebuildIndex(field: keyof T) {
		const data = await this.readFile();
		const index = this.indexes.find((idx) => idx.field === field);
		if (!index) return;

		index.values.clear();
		for (const item of data) {
			const value = item[field];
			if (!index.values.has(value)) {
				index.values.set(value, []);
			}
			index.values.get(value)?.push(item.id);
		}
	}

	private updateIndexes(item: T): void {
		for (const index of this.indexes) {
			const value = item[index.field];
			if (!index.values.has(value)) {
				index.values.set(value, []);
			}
			index.values.get(value)?.push(item.id);
		}
	}

	private removeFromIndexes(id: string): void {
		for (const index of this.indexes) {
			for (const [value, ids] of index.values) {
				const idIndex = ids.indexOf(id);
				if (idIndex !== -1) {
					ids.splice(idIndex, 1);
					if (ids.length === 0) {
						index.values.delete(value);
					}
				}
			}
		}
	}

	/**
	 * Executes a database operation within a transaction, ensuring data consistency.
	 *
	 * A backup of the database file is created before the operation is performed.
	 * If the operation completes successfully, the backup is deleted. If an error
	 * occurs during the operation, the backup is restored to maintain the original
	 * state of the database.
	 *
	 * This method utilizes concurrency handling to ensure that the operation is
	 * performed with proper locking.
	 *
	 * @param operation - The asynchronous operation to be executed within the transaction.
	 * @returns A promise that resolves to the result of the operation, or undefined
	 * if the operation fails after maximum retries.
	 * @throws An error if the operation fails and the backup restoration also fails.
	 */
	async transaction<R>(operation: () => Promise<R>): Promise<R | undefined> {
		return this.handleConcurrency(async () => {
			const backupPath = `${this.#filePath}.backup`;
			await copyFile(this.#filePath, backupPath);
			try {
				const result = await operation();
				await unlink(backupPath);
				return result;
			} catch (error) {
				await copyFile(backupPath, this.#filePath);
				await unlink(backupPath);
				throw error;
			}
		});
	}

	async findBy(
		field: keyof T,
		value: unknown,
		options: QueryOptions = {},
	): Promise<T[]> {
		const index = this.indexes.find((idx) => idx.field === field);
		let result: T[];
		if (index) {
			const ids = index.values.get(value) || [];
			const data = await this.readFile();
			result = ids.map((id) => data.find((item) => item.id === id)!);
		} else {
			const data = await this.readFile();
			result = data.filter((item) => item[field] === value);
		}
		return this.applyQueryOptions(result, options);
	}

	private applyQueryOptions(data: T[], options: QueryOptions): T[] {
		let result = [...data];
		if (options.orderBy) {
			result.sort((a, b) => {
				if (a[options.orderBy!] < b[options.orderBy!])
					return options.order === "desc" ? 1 : -1;
				if (a[options.orderBy!] > b[options.orderBy!])
					return options.order === "desc" ? -1 : 1;
				return 0;
			});
		}
		if (options.offset) {
			result = result.slice(options.offset);
		}
		if (options.limit) {
			result = result.slice(0, options.limit);
		}
		return result;
	}

	addMigration(migration: Migration): void {
		this.migrations.push(migration);
		this.migrations.sort((a, b) => a.version - b.version);
	}

	async migrate(targetVersion?: number): Promise<void> {
		const data = await this.readFile();
		const currentVersion = this.currentVersion;
		const targetVer =
			targetVersion ?? Math.max(...this.migrations.map((m) => m.version));

		if (currentVersion < targetVer) {
			for (const migration of this.migrations) {
				if (
					migration.version > currentVersion &&
					migration.version <= targetVer
				) {
					await this.writeFile(migration.up(data));
					this.currentVersion = migration.version;
				}
			}
		} else if (currentVersion > targetVer) {
			for (const migration of this.migrations.slice().reverse()) {
				if (
					migration.version <= currentVersion &&
					migration.version > targetVer
				) {
					await this.writeFile(migration.down(data));
					this.currentVersion = migration.version - 1;
				}
			}
		}
	}

	/**
	 * Sets the concurrency strategy for the database operations.
	 *
	 * Allows choosing between different strategies to handle concurrent
	 * modifications to the database.
	 *
	 * @param strategy - The concurrency strategy to be set. It can be one of the
	 * following:
	 * - "optimistic": Throws an error if the data has changed since the last read.
	 * - "versioning": Auto-increments a version number for each update and throws
	 *   an error if the version number has changed since the last read.
	 * - "none": No concurrency checks will be made.
	 */
	setConcurrencyStrategy(strategy: ConcurrencyStrategy): void {
		this.concurrencyStrategy = strategy;
	}

	/**
	 * Sets the lock timeout duration for acquiring a lock on the database.
	 *
	 * @param timeout - The duration in milliseconds after which the lock will expire if not released.
	 */
	setLockTimeout(timeout: number): void {
		this.lockTimeout = timeout;
	}

	async query(
		queryFn: (item: T) => boolean,
		options: QueryOptionsPartial = {},
	): Promise<T[]> {
		const data = await this.readFile();
		const result = data.filter(queryFn);
		return this.applyQueryOptions(result, options);
	}
}
