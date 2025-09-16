import { Schema } from "effect";
import type { Mutable } from "effect/Types";

export const IndexDefinitionSchema = Schema.Struct({
  unique: Schema.Boolean,
  multi_entry: Schema.Boolean,
  primary_key: Schema.optional(Schema.Boolean),
  auto_increment: Schema.optional(Schema.Boolean),
  uuid: Schema.optional(Schema.Boolean),
  compound_path: Schema.optional(Schema.Array(Schema.String))
});

export type IndexDefinition = Mutable<typeof IndexDefinitionSchema.Type>;

export const CollectionMetadataSchema = Schema.Struct({
  created_at: Schema.Date,
  updated_at: Schema.Date,
  document_count: Schema.Number,
  indexes: Schema.Record({ key: Schema.String, value: IndexDefinitionSchema })
});

export type CollectionMetadata = typeof CollectionMetadataSchema.Type;
