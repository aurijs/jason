import type { Schema } from "effect";

/** Trim left space from a string */
type TrimLeft<T extends string> = T extends ` ${infer R}` ? TrimLeft<R> : T;
/** Trim right space from a string */
type TrimRight<T extends string> = T extends `${infer R} ` ? TrimRight<R> : T;
/** Trim left and right space from a string */
type Trim<T extends string> = TrimLeft<TrimRight<T>>;

export type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  date: Date;
  any: any;
  unknown: unknown;
  null: null;
  bigint: bigint;
};

/**
 * Parse a type string into a TypeScript type.
 */
type ParseType<T extends string> =
  Trim<T> extends keyof TypeMap
    ? TypeMap[Trim<T>]
    : Trim<T> extends `array<${infer Inner}>`
      ? ParseType<Inner>[]
      : Trim<T> extends `record<${infer K},${infer V}>`
        ? Record<ParseType<K> & (string | number | symbol), ParseType<V>>
        : ParseTypeName<T>;

export type CleanKey<T extends string> = T extends
  | `++${infer K}`
  | `&${infer K}`
  | `@${infer K}`
  | `[${infer K}]`
  | `*${infer K}`
  ? /**
     * Remove the special prefix from a key.
     * This is used to create a key that is valid for JSON Schema.
     */
    K
  : T;

/**
 * Maps a type name string to its corresponding TypeScript type.
 * If the type name exists in TypeMap, returns the mapped type; otherwise returns 'any'.
 */
type ParseTypeName<T extends string> = T extends keyof TypeMap
  ? TypeMap[T]
  : any;

/**
 * Verify if the key of a field has the `*` prefix
 */
type IsMultiEntry<T extends string> = T extends `*${string}` ? true : false;

export type ParseField<T extends string> =
  T extends `${infer Key}:${infer TypeName}`
    ? {
        [K in CleanKey<Trim<Key>>]: IsMultiEntry<Trim<Key>> extends true
          ? ParseType<TypeName>[]
          : ParseType<TypeName>;
      }
    : {
        [K in CleanKey<Trim<T>>]: IsMultiEntry<Trim<T>> extends true
          ? string[]
          : string;
      };

export type Split<S extends string, D extends string> = string extends S
  ? string[]
  : S extends ""
    ? []
    : /**
       * Split a string into an array of strings using a delimiter.
       * Examples: "name,string,age:number" => ["name", "string", "age", "number"]
       */
      S extends `${infer T}${D}${infer U}`
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
 * This is a utility type that is useful for converting
 * a JSON Schema string into a JSON Schema object.
 */
export type ParseSchemaString<T extends string> = UnionToIntersection<
  ParseField<Split<T, ";">[number]>
>;

/**
 * Represents a standard schema compliant with @standard-schema/spec.
 */
export interface StandardSchemaV1<Input = any, Output = any> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) =>
      | StandardSchemaV1.Result<Output>
      | Promise<StandardSchemaV1.Result<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  };
}

export namespace StandardSchemaV1 {
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey>;
  }
}

/**
 * Represents a schema definition, which can be either
 * an Effect Schema.Struct, a standard-schema compliant validator, or a string.
 */
export type SchemaOrString =
  | string
  | Schema.Schema<any, any>
  | StandardSchemaV1<any, any>;
