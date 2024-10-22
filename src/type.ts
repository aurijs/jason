import type JasonDB from "./index";

/**
 * Represents a database data type.
 *
 * @template T The type of data in the database.
 */
export type DatabaseData<T> = Record<string, T>;

/**
 * Represents a test data type.
 */
export interface ITest {
	/**
	 * The unique identifier of the test.
	 */
	id: number;
	/**
	 * The name of the test.
	 */
	name: string;
}

/**
 * Represents a required test data type.
 *
 * @see ITest
 */
export type ITestRequired = Required<ITest>;

/**
 * Represents an index type.
 *
 * @template T The type of data in the index.
 */
export interface Index<T> {
	/**
	 * The field of the index.
	 */
	field: keyof T;
	/**
	 * The values of the index.
	 */
	values: Map<unknown, string[]>;
}

/**
 * Represents a validation function type.
 *
 * @template T The type of data being validated.
 */
export type ValidationFunction<T> = (item: T) => boolean;

/**
 * Represents a plugin type.
 *
 * @template T The type of data in the database.
 */
export type Plugin<T> = (orm: JasonDB<T>) => void;

/**
 * Represents a migration type.
 */
export interface Migration {
	/**
	 * The version of the migration.
	 */
	version: number;
	/**
	 * The up function of the migration.
	 */
	up: (data: unknown[]) => unknown[];
	/**
	 * The down function of the migration.
	 */
	down: (data: unknown[]) => unknown[];
}

/**
 * Represents a query options type.
 *
 * @template T The type of data being queried.
 */
export interface QueryOptions {
	/**
	 * The limit of the query.
	 */
	limit?: number;
	/**
	 * The offset of the query.
	 */
	offset?: number;
	/**
	 * The order by field of the query.
	 */
	orderBy?: string;
	/**
	 * The order of the query.
	 */
	order?: "asc" | "desc";
}

/**
 * Represents a partial query options type.
 *
 * @template T The type of data being queried.
 * @see QueryOptions
 */
export type QueryOptionsPartial = Partial<QueryOptions>;
