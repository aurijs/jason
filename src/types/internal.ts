export type IndexSchemaType =
  | "auto-increment-pk"
  | "uuid-pk"
  | "unique"
  | "multi-value"
  | "compound"
  | "standard";

export interface ParsedIndexDefinition {
  originalSpec: string;
  type: IndexSchemaType;
  fieldName: string;
  fields?: string[]; // For compound indexes
}