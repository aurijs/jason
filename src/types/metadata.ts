import { Schema } from "effect";
import type { Mutable } from "effect/Types";

/**
 * Defines the structure of an index in the database.
 */
export const IndexDefinitionSchema = Schema.Struct({
  /**
   * Indicates if the field is indexed.
   */
  indexed: Schema.optional(Schema.Boolean),
  /**
   * The field(s) that the index is built on.
   * This can be a single field or a compound path (array of fields).
   *
   * Indicated by an `&`
   */
  unique: Schema.Boolean,
  /**
   * Indicates if the index supports multiple entries for a single key.
   *
   * Indicated by an `*`
   */
  multi_entry: Schema.Boolean,

  /**
   * Indicates if the index is the primary key of the collection.
   *
   * Indicated by an `++` or `@`
   */
  primary_key: Schema.optional(Schema.Boolean),

  /**
   * Indicates if the index is auto-incrementing.
   *
   * Used by the `++` kind of primary-key
   */
  auto_increment: Schema.optional(Schema.Boolean),

  /**
   * Indicates if the index is based on UUIDs.
   *
   * Indicated by the `@` kind of primary-key
   */
  uuid: Schema.optional(Schema.Boolean),

  /**
   * The compound path for the index, if applicable.
   *
   * Indicated by `[key_one+key_two]`
   */
  compound_path: Schema.optional(Schema.Array(Schema.String))
});

/**
 * Type representing an index definition in the database.
 */
export type IndexDefinition = Mutable<typeof IndexDefinitionSchema.Type>;

/**
 * Metadata information about a collection in the database.
 */
export const CollectionMetadataSchema = Schema.Struct({
  created_at: Schema.Date,
  updated_at: Schema.Date,
  document_count: Schema.Number,
  indexes: Schema.Record({ key: Schema.String, value: IndexDefinitionSchema })
});

export type CollectionMetadata = typeof CollectionMetadataSchema.Type;
