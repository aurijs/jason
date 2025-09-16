import { Schema, type Effect, type Stream } from "effect";
import type { DatabaseError } from "../core/errors.js";
import type { ParseSchemaString, SchemaOrString } from "./schema.js";

export type Filter<Doc> = Partial<Doc>;

interface OrderBy<Doc> {
  field: keyof Doc;
  order: "asc" | "desc";
}

export interface QueryOptions<Doc> {
  where: Filter<Doc>;
  order_by?: OrderBy<Doc>;
  skip?: number;
  limit?: number;
}

export interface CollectionEffect<Doc> {
  readonly create: (data: Omit<Doc, "id">) => Effect.Effect<Doc, Error>;
  readonly findById: (id: string) => Effect.Effect<Doc | undefined, Error>;
  readonly update: (
    id: string,
    data: Partial<Omit<Doc, "id">>
  ) => Effect.Effect<Doc | undefined, DatabaseError>;
  readonly delete: (id: string) => Effect.Effect<boolean, DatabaseError>;
  readonly find: (options: QueryOptions<Doc>) => Effect.Effect<Doc[], Error>;
  readonly findStream: (
    options: QueryOptions<Doc>
  ) => Stream.Stream<Doc, DatabaseError>;
}

export interface Collection<Doc> {
  /**
   * Creates a new document in the collection
   * @param data - The data to be stored in the document
   * @returns The created document
   */
  create: (data: Omit<Doc, "id">) => Promise<Doc>;

  /**
   * Retrieves a document by its id
   * @param id - The id of the document to retrieve
   * @returns The retrieved document
   */
  findById: (id: string) => Promise<Doc>;
  readonly update: (id: string, data: Partial<Omit<Doc, "id">>) => Promise<Doc>;
  readonly delete: (id: string) => Promise<boolean>;
  readonly find: (options: QueryOptions<Doc>) => Promise<Doc[]>;
}

export type InferCollections<T extends Record<string, SchemaOrString>> = {
  [K in keyof T]: T[K] extends Schema.Schema<any, infer A>
    ? A
    : T[K] extends string
      ? ParseSchemaString<T[K]>
      : any;
};

export interface JasonDBConfig<T extends Record<string, SchemaOrString>> {
  readonly base_path: string;
  readonly collections: T;
}
