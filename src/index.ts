import fs from "node:fs/promises";
import path from "node:path";
import type {
	Index,
	Migration,
	Plugin,
	QueryOptions,
	ValidationFunction,
	DatabaseData,
	QueryOptionsPartial,
} from "./type";
import Cache from "./cache";

export default class JasonDB<T> {
	private filePath: string;
	private schema: ValidationFunction<T>;
	private plugins: Plugin<T>[] = [];
	private indexes: Index<T>[] = [];
	private cache = new Cache();
	private migrations: Migration[] = [];
	private currentVersion = 0;

	constructor(
		fileName: string,
		initialData?: T[],
		schema?: ValidationFunction<T>,
	) {
		this.filePath = path.join(process.cwd(), `${fileName}.json`);
		this.schema = schema || (() => true);
		if (initialData) {
			this.initializeData(initialData);
		}
	}

	private async initializeData(initialData: T[]): Promise<void> {
		try {
			await fs.access(this.filePath);
		} catch {
			await this.writeFile(initialData);
		}
	}

	private async readFile(): Promise<T[]> {
		try {
			const data = await fs.readFile(this.filePath, "utf-8");
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
		await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
	}

	async create(item: T): Promise<T> {
		if (!this.schema(item)) {
			throw new Error("Invalid item schema");
		}
		const data = await this.readFile();
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

	async update(id: string, updatedItem: Partial<T>): Promise<T | null> {
		const data = await this.readFile();
		const index = data.findIndex((item) => item.id === id);
		if (index === -1) return null;
		const newItem = { ...data[index], ...updatedItem } as T;
		if (!this.schema(newItem)) {
			throw new Error("Invalid item schema");
		}
		data[index] = newItem;
		await this.writeFile(data);
		this.updateIndexes(newItem);
		this.cache.updateCache(newItem);
		return newItem;
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

	private async rebuildIndex(field: keyof T){
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

	async transaction<R>(operation: () => Promise<R>): Promise<R> {
		const backupPath = `${this.filePath}.backup`;
		await fs.copyFile(this.filePath, backupPath);
		try {
			const result = await operation();
			await fs.unlink(backupPath);
			return result;
		} catch (error) {
			await fs.copyFile(backupPath, this.filePath);
			await fs.unlink(backupPath);
			throw error;
		}
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

	async query(
		queryFn: (item: T) => boolean,
		options: QueryOptionsPartial = {},
	): Promise<T[]> {
		const data = await this.readFile();
		const result = data.filter(queryFn);
		return this.applyQueryOptions(result, options);
	}
}
