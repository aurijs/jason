import type { Schema } from "effect";

export type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  date: Date;
  any: any;
  unknown: unknown;
};

export type CleanKey<T extends string> = T extends
  | `++${infer K}`
  | `&${infer K}`
  | `*${infer K}`
    /**
     * Remove the special prefix from a key.
     * This is used to create a key that is valid for JSON Schema.
     */
    ? K
    : T;

export type ParseField<T extends string> =
  /**
   * Split a field string into a key and a type.
   * Examples: "name:string", "age:number"
   */
  T extends `${infer Key}:${infer TypeName}`
    /**
     * If the type is a valid type,
     * return an object with the key and the type.
     * Otherwise, return an object with the key and type `any`.
     */
    ? TypeName extends keyof TypeMap
      ? { [K in CleanKey<Key>]: TypeMap[TypeName] }
      : { [K in CleanKey<Key>]: any }
    : { [K in CleanKey<T>]: string };

export type Split<S extends string, D extends string> = string extends S
  ? string[]
  : S extends ""
  ? []
  /**
   * Split a string into an array of strings using a delimiter.
   * Examples: "name,string,age:number" => ["name", "string", "age", "number"]
   */
  : S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

/**
 * Convert a union type to an intersection type.
 * This is a utility type that is useful for combining multiple types into one.
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Parse a JSON Schema string into a JSON Schema object.
 * This is a utility type that is useful for converting a JSON Schema string into a JSON Schema object.
 */
export type ParseSchemaString<T extends string> = UnionToIntersection<
  ParseField<Split<T, ",">[number]>
>;

export type SchemaOrString = Schema.Schema<any, any> | string;

export interface JasonDBConfig<T extends Record<string, SchemaOrString>> {
  readonly path: string;
  readonly collections: T;
}

