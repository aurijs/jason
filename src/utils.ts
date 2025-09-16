import { Schema } from "effect";
import type { IndexDefinition } from "./types/metadata.js";

/**
 * Parses a schema string into a structured format.
 * @param schema_string A string representing the schema, e.g., "id, name, age"
 * @returns A Schema.Struct representing the parsed schema.
 */
export function parseSchemaFromString(schema_string: string) {
  const fields = schema_string.split(",").reduce(
    (acc, field) => {
      const field_name = field.replace(/^\+\+|[&*]/, "");
      acc[field_name] = Schema.Any;
      return acc;
    },
    {} as Record<string, Schema.Schema<any, any>>
  );
  return Schema.Struct(fields);
}

/**
 * Retries an async operation a specified number of times, with exponential backoff between retries.
 *
 * @param fn - The async operation to retry.
 * @param maxRetries - The maximum number of retries. Defaults to 10.
 * @param baseDelay - The initial delay in milliseconds. Defaults to 10.
 * @returns The result of the successfully executed operation.
 * @throws The error that caused the last retry to fail.
 */
export async function retryAsyncOperation<T>(
  fn: () => Promise<T>,
  maxRetries = 10,
  baseDelay = 10
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }

  throw new Error("Unreachable");
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

  const parts = index_string.split(",").map((part) => part.trim());

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
