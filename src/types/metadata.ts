import { Schema } from "effect";

export const IndexDefinitionSchema = Schema.Struct({
  unique: Schema.Boolean,
  multi_entry: Schema.Boolean
});

export type IndexDefinition = typeof IndexDefinitionSchema.Type;

export const CollectionMetadataSchema = Schema.Struct({
  created_at: Schema.Date,
  updated_at: Schema.Date,
  document_count: Schema.Number,
  indexes: Schema.Record({ key: Schema.String, value: IndexDefinitionSchema })
});

export type CollectionMetadata = typeof CollectionMetadataSchema.Type;
