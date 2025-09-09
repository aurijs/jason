import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Context, Effect, Layer, Runtime, Schema } from "effect";
import { makeCollection } from "../services/collection.js";

type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  date: Date;
  any: any;
  unknown: unknown;
};

type CleanKey<T extends string> = T extends
  | `++${infer K}`
  | `&${infer K}`
  | `*${infer K}`
  ? K
  : T;

type ParseField<T extends string> = T extends `${infer Key}:${infer TypeName}`
  ? TypeName extends keyof TypeMap
  ? { [K in CleanKey<Key>]: TypeMap[TypeName] }
  : { [K in CleanKey<Key>]: any }
  : { [K in CleanKey<T>]: string };

type Split<S extends string, D extends string> = string extends S
  ? string[]
  : S extends ""
  ? []
  : S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

type ParseSchemaString<T extends string> = UnionToIntersection<
  ParseField<Split<T, ",">[number]>
>;

interface Document {
  id: string;
  [key: string]: any;
}

interface CollectionEffect<D extends Document> {
  create: (data: Omit<D, "id">) => Effect.Effect<Document | undefined, Error>;
  read: (id: string) => Effect.Effect<D, Error>;
}

interface Collection<D extends Document> {
  create: (data: Omit<D, "id">) => Promise<D>;
  read: (id: string) => Promise<D>;
}

interface DatabaseEffect<Collections extends Record<string, any>> {
  readonly collections: {
    [K in keyof Collections]: CollectionEffect<Collections[K]>;
  };
}

interface Database<Collections extends Record<string, any>> {
  readonly collections: {
    [K in keyof Collections]: Collection<Collections[K]>;
  };
}

type InferCollections<T extends Record<string, SchemaOrString>> = {
  [K in keyof T]: T[K] extends Schema.Schema<any, infer A>
  ? A
  : T[K] extends string
  ? ParseSchemaString<T[K]>
  : any;
};

class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  DatabaseEffect<any>
>() { }

type SchemaOrString = Schema.Schema<any, any> | string;

interface JasonDBConfig<T extends Record<string, SchemaOrString>> {
  readonly path: string;
  readonly collections: T;
}

function parseSchemaFromString(schema_string: string) {
  const fields = schema_string.split(",").reduce((acc, field) => {
    const field_name = field.replace(/^\+\+|[&*]/, "");
    acc[field_name] = Schema.Any;
    return acc;
  }, {} as Record<string, Schema.Schema<any, any>>);
  return Schema.Struct(fields);
}

export const createJasonDBLayer = <const T extends Record<string, SchemaOrString>>(
  config: JasonDBConfig<T>
) =>
  Layer.scoped(
    DatabaseService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const base_path = config.path;
      yield* fs.makeDirectory(base_path, { recursive: true });

      const collection_services: Record<string, CollectionEffect<any>> = {};

      for (const name in config.collections) {
        const schema_or_string = config.collections[name];
        const schema =
          typeof schema_or_string === "string"
            ? parseSchemaFromString(schema_or_string)
            : schema_or_string as Schema.Schema<any, any>;

        const collection_path = `${base_path}/${name}`;
        yield* fs.makeDirectory(collection_path, { recursive: true });

        collection_services[name] = yield* makeCollection(collection_path, schema);
      }

      type CollectionsSchema = {
        [K in keyof T]: T[K] extends Schema.Schema<any, infer A> ? A : any;
      };

      const databaseService: DatabaseEffect<CollectionsSchema> = {
        collections: collection_services as any,
      };

      return databaseService;
    })
  ).pipe(Layer.provide(NodeFileSystem.layer));

export const createJasonDB = async <const T extends Record<string, SchemaOrString>>(
  config: JasonDBConfig<T>
): Promise<Database<InferCollections<T>>> => {
  const layer = createJasonDBLayer(config);
  const runtime = await Effect.runPromise(
    Layer.toRuntime(layer).pipe(Effect.scoped)
  );
  const run = Runtime.runPromise(runtime);
  const effect_base_db = await run(DatabaseService);
  const promise_based_collection: Record<string, Collection<any>> = {};

  for (const name in effect_base_db.collections) {
    const effect_based_collection = effect_base_db.collections[name];

    promise_based_collection[name] = {
      create: (data: any) => run(effect_based_collection.create(data)),
      read: (id: string) => run(effect_based_collection.read(id))
    };
  }

  const promise_based_db = {
    collections: promise_based_collection,
  };

  return promise_based_db as Database<InferCollections<T>>;
};
