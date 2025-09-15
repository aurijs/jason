import { Schema } from "effect";

export const IndexDefinitionSchema = Schema.Struct({
  unique: Schema.Boolean,
  multi_entry: Schema.Boolean
});

export type IndexDefinition = Schema.Schema.Type<typeof IndexDefinitionSchema>;

export const CollectionMetadataSchema = Schema.Struct({
  created_at: Schema.Date,
  updated_at: Schema.Date,
  document_count: Schema.Number,
  indexes: Schema.Record({ key: Schema.String, value: IndexDefinitionSchema })
});

export type CollectionMetadata = Schema.Schema.Type<
  typeof CollectionMetadataSchema
>;
