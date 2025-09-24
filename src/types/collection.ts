import type { PlatformError } from "@effect/platform/Error";
import { Schema, type Effect, type Stream } from "effect";
import type { DatabaseError } from "../core/errors.js";
import type { ParseSchemaString, SchemaOrString } from "./schema.js";

/**
 * A filter object used to specify criteria for querying documents in a collection.
 */
export type Filter<Doc> = Partial<Doc>;

interface OrderBy<Doc> {
  /**
   * The field to order by.
   * This should be a key of the document type `Doc`.
   */
  field: keyof Doc;
  /**
   * The order direction, either ascending (`asc`) or descending (`desc`).
   */
  order: "asc" | "desc";
}

export interface QueryOptions<Doc> {
  /**
   * The filter criteria to apply to the query.
   *
   * @example
   * db.collections.user.find({
   *    where: {age: 20}
   * })
   */
  where: Filter<Doc>;

  /**
   * The ordering criteria to apply to the query.
   *
   * @example
   * db.collections.user.find({
   *    where: { age: 20 }
   *    order_by: { field: 'age', order: 'asc' }
   * })
   */
  order_by?: OrderBy<Doc>;

  /**
   * The number of documents to skip in the query results.
   */
  skip?: number;

  /**
   * The maximum number of documents to return in the query results.
   */
  limit?: number;
}

/**
 * Represents a collection of documents, with methods that return `Effect` computations.
 * This interface is for users who prefer to work within the `Effect` ecosystem for handling asynchronous operations and errors.
 */
export interface CollectionEffect<Doc> {
  /**
   * Creates a new document in the collection.
   * @param data The data for the new document, excluding the 'id'.
   * @returns An `Effect` that resolves to the created document or fails with an `Error`.
   */
  readonly create: (data: Omit<Doc, "id">) => Effect.Effect<Doc, Error>;
  /**
   * Retrieves a document by its ID.
   * @param id The ID of the document to retrieve.
   * @returns An `Effect` that resolves to the document or `undefined` if not found, and can fail with an `Error`.
   */
  readonly findById: (id: string) => Effect.Effect<Doc | undefined, Error>;
  /**
   * Updates a document by its ID with partial data.
   * @param id The ID of the document to update.
   * @param data The partial data to update in the document.
   * @returns An `Effect` that resolves to the updated document or `undefined` if not found, and can fail with a `DatabaseError`.
   */
  readonly update: (
    id: string,
    data: Partial<Omit<Doc, "id">>
  ) => Effect.Effect<Doc | undefined, DatabaseError>;
  /**
   * Deletes a document by its ID.
   * @param id The ID of the document to delete.
   * @returns An `Effect` that resolves to `true` if the document was deleted, `false` otherwise, and can fail with a `DatabaseError`.
   */
  readonly delete: (id: string) => Effect.Effect<boolean, DatabaseError>;
  /**
   * Finds documents based on query options.
   * @param options Query options for filtering, ordering, and pagination.
   * @returns An `Effect` that resolves to an array of documents and can fail with an `Error`.
   */
  readonly find: (options: QueryOptions<Doc>) => Effect.Effect<Doc[], Error>;
  /**
   * Finds documents and returns them as a `Stream`.
   * This is useful for processing large datasets efficiently.
   * @param options Query options for filtering and ordering.
   * @returns A `Stream` of documents that can fail with a `DatabaseError`.
   */
  readonly findStream: (
    options: QueryOptions<Doc>
  ) => Stream.Stream<Doc, DatabaseError>;
  /**
   * Checks if a document with the given ID exists.
   * @param id The ID of the document to check.
   * @returns An `Effect` that resolves to `true` if the document exists, `false` otherwise, and can fail with a `PlatformError`.
   */
  readonly has: (id: string) => Effect.Effect<boolean, PlatformError>;
  /**
   * Finds a single document based on query options.
   * @param options Query options for filtering and ordering.
   * @returns An `Effect` that resolves to a single document or `undefined` if not found, and can fail with a `PlatformError`.
   */
  readonly findOne: (
    options: QueryOptions<Doc>
  ) => Effect.Effect<Doc | undefined, PlatformError>;
}

/**
 * Represents a collection of documents in the database.
 */
export interface Collection<Doc> {
  /**
   * Creates a new document in the collection.
   * @param data - The data to be stored in the document.
   * @returns The created document.
   */
  readonly create: (data: Omit<Doc, "id">) => Promise<Doc>;

  /**
   * Retrieves a document by its id.
   * @param id - The id of the document to retrieve.
   * @returns The retrieved document, or `undefined` if not found.
   */
  readonly findById: (id: string) => Promise<Doc | undefined>;

  /**
   * Updates a document by its id.
   * @param id - The id of the document to update.
   * @param data - The data to update in the document.
   * @returns The updated document, or `undefined` if the document with the given id was not found.
   */
  readonly update: (
    id: string,
    data: Partial<Omit<Doc, "id">>
  ) => Promise<Doc | undefined>;

  /**
   * Deletes a document by its id.
   * @param id - The id of the document to delete.
   * @returns A promise that resolves to `true` if the document was deleted, `false` otherwise.
   */
  readonly delete: (id: string) => Promise<boolean>;

  /**
   * Finds documents based on the provided query options.
   * @param options - Query options including filtering, ordering, skipping, and limiting.
   * @returns A promise that resolves to an array of documents.
   */
  readonly find: (options: QueryOptions<Doc>) => Promise<Doc[]>;

  /**
   * Checks if a document with the given id exists in the collection.
   * @param id The id of the document to check.
   * @returns A promise that resolves to `true` if the document exists, `false` otherwise.
   */
  readonly has: (id: string) => Promise<boolean>;

  /**
   * Finds a single document based on the provided query options.
   * @param options - Query options including filtering and ordering.
   * @returns A promise that resolves to a single document or undefined if not found.
   */
  readonly findOne: (options: QueryOptions<Doc>) => Promise<Doc | undefined>;
}

/**
 * A utility type that infers the document types for all collections defined in the database configuration.
 * It maps over the `collections` object and resolves each schema (whether a `Schema` object or a schema string)
 * to its corresponding TypeScript type.
 *
 * @template T - The type of the `collections` configuration object.
 */
export type InferCollections<T extends Record<string, SchemaOrString>> = {
  [K in keyof T]: T[K] extends Schema.Schema<any, infer A>
    ? A
    : T[K] extends string
      ? ParseSchemaString<T[K]>
      : any;
};

/**
 * Configuration options for creating a JasonDB instance.
 */
export interface JasonDBConfig<T extends Record<string, SchemaOrString>> {
  /**
   * The base path where the database files will be stored.
   *
   * @example
   * const db = await createJasonDB({
   *  base_path: "db_dir",
   * });
   */
  readonly base_path: string;
  /**
   * A record defining the schemas for the database collections.
   *
   * You can define schemas using `Effect.Schema` objects or a convenient string-based syntax.
   * The types for your collections are automatically inferred from these definitions.
   *
   * Example of defining collections with schema strings
   * ```ts
   * const db = await createJasonDB({
   *  base_path: "db_dir",
   *  collections: {
   *    user: "@id;name;age:number;email;isManager:boolean",
   *    post: "@id;title;author;*tags"
   *  }
   * });
   * ```
   * 
   * Accessing a collection
   * ```ts
   * const { user } = db.collections;
   * ```
   *
   * ### Schema String Syntax
   *
   * The string syntax is a shorthand for defining fields and indexes.
   * Fields are separated by semicolons `;`.
   *
   * #### Field Types
   *
   * Specify a type by appending a colon `:` followed by the type name.
   * If no type is specified, it defaults to `string`.
   *
   * - `fieldName:string` = `string`
   * - `fieldName:number` = `number`
   * - `fieldName:boolean` = `boolean`
   * - `fieldName:date` = `Date`
   * - `fieldName:array<type>` = `type[]` (e.g., `items:array<string>`)
   * - `fieldName:record<key, value>` = `Record<key, value>` (e.g., `props:record<string, number>`)
   *
   * #### Index Modifiers
   *
   * You can prefix a field name with a symbol to create an index.
   *
   * - `@id`: Primary key (UUID).
   * - `++id`: Primary key (auto-incrementing number).
   * - `&name`: A unique index on the `name` field.
   * - `*tags`: A multi-entry index, ideal for array fields. The field type will be inferred as an array (e.g., `*tags:string` becomes `tags: string[]`).
   * - `[name+email]`: A compound index on `name` and `email`.
   *
   * All defined schemas are validated at runtime using `Effect.Schema`.
   */
  readonly collections: T;
}
