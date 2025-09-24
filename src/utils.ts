import { Schema } from "effect";
import type { IndexDefinition } from "./types/metadata.js";
import { parse } from "mdurl/index.js";

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

interface ParsedFields {
  field_name: string;
  type_name: string;
  is_multi_entry: boolean;
  is_primary_key_auto_inc: boolean;
  is_primary_key_uuid: boolean;
  is_unique: boolean;
  compound_path: string[] | undefined;
}

export function parseSchemaString(schema_string: string) {
  if (!schema_string.trim()) return [];

  const parts = schema_string.split(";").map((t) => t.trim());
  const parsed_fields: ParsedFields[] = [];

  for (const part of parts) {
    if (!part) continue;

    let field_definition = part;
    let type_name = "string"; // default type

    if (part.includes(":")) {
      const [def, type] = part.split(":", 2);
      field_definition = def;
      type_name = type;
    }

    const is_multi_entry = field_definition.startsWith("*");
    const is_primary_key_auto_inc = field_definition.startsWith("++");
    const is_primary_key_uuid = field_definition.startsWith("@");
    const is_unique =
      field_definition.startsWith("&") ||
      is_primary_key_auto_inc ||
      is_primary_key_uuid;

    const is_compound =
      field_definition.startsWith("[") && field_definition.endsWith("]");

    let clean_field_name = field_definition.replace(/^[++@&*]/, "");

    let compound_path: string[] | undefined = undefined;

    if (is_compound) {
      clean_field_name = field_definition;
      compound_path = field_definition.slice(1, -1).split("+");
    }

    parsed_fields.push({
      field_name: clean_field_name,
      type_name,
      is_multi_entry,
      is_primary_key_auto_inc,
      is_primary_key_uuid,
      is_unique,
      compound_path
    });
  }

  return parsed_fields;
}

export function buildIndexDefinitions(parsed_fields: ParsedFields[]) {
  const definitions: Record<string, IndexDefinition> = {};

  for (const field of parsed_fields) {
    definitions[field.field_name] = {
      unique: field.is_unique,
      multi_entry: field.is_multi_entry,
      compound_path: field.compound_path,
      auto_increment: field.is_primary_key_auto_inc,
      uuid: field.is_primary_key_uuid,
      primary_key: field.is_primary_key_auto_inc || field.is_primary_key_uuid
    };
  }

  return definitions;
}

export function buildSchema(parsed_fields: ParsedFields[]) {
  const fields: Record<string, Schema.Schema<any, any>> = {};
  for (const field of parsed_fields) {
    if (field.compound_path) continue;

    let type_name = field.type_name as keyof typeof schema_map;
    if (field.is_primary_key_auto_inc) type_name = "number";
    if (field.is_primary_key_uuid) type_name = "string";

    let field_schema = schema_map[type_name] ?? Schema.Any;
    if (field.is_multi_entry) field_schema = Schema.Array(field_schema);
    fields[field.field_name] = field_schema;
  }

  return Schema.Struct(fields);
}

/**
 * Parses a schema string into a structured format.
 * @param schema_string A string representing the schema, e.g., "id, name, age"
 * @returns A Schema.Struct representing the parsed schema.
 */
export function parseSchemaFromString(schema_string: string) {
  const fields: any = {};

  const parts = schema_string.split(";").map((t) => t.trim());
  for (const part of parts) {
    if (!part) continue;

    let field_definition = part;
    let type_name = "string" as keyof typeof schema_map; // default type

    if (part.includes(":")) {
      const [def, type] = part.split(":", 2);
      field_definition = def;
      type_name = type as any;
    }

    if (part.startsWith("[")) {
      const is_unique = part.startsWith("&[");
      const compound_path = part.slice(is_unique ? 2 : 1, -1).split("+");
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

export function generateSchemaFromDefinitions(
  definitions: Record<string, IndexDefinition>
) {
  const fields: Record<string, Schema.Schema<any, any>> = {};

  for (const field in definitions) {
    const definition = definitions[field];

    let field_definition = field;
    let type_name = "string" as keyof typeof schema_map; // default type

    if (field.includes(":")) {
      const [def, type] = field.split(":", 2);
      field_definition = def;
      type_name = type as any;
    }

    if (definition.compound_path) continue;

    if (definition.auto_increment) type_name = "number";
    if (definition.uuid) type_name = "string";

    let field_schema = schema_map[type_name] ?? Schema.Any;
    if (definition.multi_entry) field_schema = Schema.Array(field_schema);
    fields[field_definition] = field_schema;
  }

  return Schema.Struct(fields);
}

/**
 * Parses an index definition string into a structured format.
 * Example input: "email:unique,age"
 * @param index_string The index definition string.
 * @returns A record of index definitions.
 */
export function extractIndexDefinitions(index_string: string) {
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
