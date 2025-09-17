import { Schema } from "effect";
import type { IndexDefinition } from "./types/metadata.js";

const schema_map = {
  string: Schema.String,
  number: Schema.Number,
  boolean: Schema.Boolean,
  date: Schema.Date,
  any: Schema.Any,
  unknown: Schema.Unknown,
  null: Schema.Null,
  bigint: Schema.BigInt
};

/**
 * Parses a schema string into a structured format.
 * @param schema_string A string representing the schema, e.g., "id, name, age"
 * @returns A Schema.Struct representing the parsed schema.
 */
export function parseSchemaFromString(schema_string: string) {
  const fields: any = {};

  const parts = schema_string.split(";");
  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith("[") && part.endsWith("]")) continue;

    let field_definition = part;
    let type_name = "string" as keyof typeof schema_map; // default type

    if (part.includes(":")) {
      const [def, type] = part.split(":", 2);
      field_definition = def;
      type_name = type as any;
    }

    const is_multi_entry = field_definition.startsWith("*");
    const is_primary_key_auto_inc = field_definition.startsWith("++");
    const is_primary_key_uuid = field_definition.startsWith("@");

    if (is_primary_key_auto_inc) {
      type_name = "number";
    }
    if (is_primary_key_uuid) {
      type_name = "string";
    }

    const clean_field_name = field_definition.replace(/^[++@&*]/, "");
    let field_schema = schema_map[type_name] ?? Schema.Any;

    if (is_multi_entry) {
      field_schema = Schema.Array(field_schema);
    }

    fields[clean_field_name] = field_schema;
  }

  return Schema.Struct(fields);
}

/**
 * Parses an index definition string into a structured format.
 * Example input: "email:unique,age"
 * @param index_string The index definition string.
 * @returns A record of index definitions.
 */
export function parseIndexString(index_string: string) {
  const definitions: Record<string, IndexDefinition> = {};
  if (typeof index_string !== "string") {
    return definitions;
  }

  if (!index_string.trim()) {
    return definitions;
  }

  const parts = index_string.split(";").map((part) => part.trim());

  for (const part of parts) {
    let field_name = part;
    const definition: IndexDefinition = {
      unique: false,
      multi_entry: false
    };

    // case 1: compound index (ex: "[field1+field2]")
    if (part.startsWith("[") && part.endsWith("]")) {
      field_name = part;
      const compound_path = part.slice(1, -1).split("+");
      definition.compound_path = compound_path;

      // can be marked as unique with the "&" prefix
      if (part.startsWith("&[")) {
        definition.unique = true;
        field_name = part.substring(2);
      }

      // case 2: primary key with auto-increment (ex: "++id")
    } else if (part.startsWith("++")) {
      field_name = part.substring(2);
      definition.primary_key = true;
      definition.unique = true;
      definition.auto_increment = true;

      // case 3: primary key with UUID (ex: "@id")
    } else if (part.startsWith("@")) {
      field_name = part.substring(1);
      definition.primary_key = true;
      definition.unique = true;
      definition.uuid = true;

      // case 4: unique index (ex: "&email")
    } else if (part.startsWith("&")) {
      field_name = part.substring(1);
      definition.unique = true;

      // case 5: multi-entry index (ex: "*tags")
    } else if (part.startsWith("*")) {
      field_name = part.substring(1);
      definition.multi_entry = true;
    }

    if (/[&*[\]+@]/g.test(field_name)) {
      throw new Error(`Invalid characters in index definition: ${part}`);
    }

    definitions[field_name] = definition;
  }

  return definitions;
}
