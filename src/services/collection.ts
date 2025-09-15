import { FileSystem } from "@effect/platform";
import { Effect, Schema, Stream } from "effect";
import { DatabaseError } from "../core/errors.js";
import { makeMetadata } from "../layers/metadata.js";
import type { QueryOptions } from "../types/collection.js";
import { JsonService } from "./json.js";
import { makeIndexService } from "../layers/index.js";
import type { IndexDefinition } from "../types/metadata.js";

/**
 * Parses an index definition string into a structured format.
 * Example input: "email:unique,age"
 * @param index_string The index definition string.
 * @returns A record of index definitions.
 */
function parseIndexString(index_string: string) {
  const definitions: Record<string, IndexDefinition> = {};

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

export const makeCollection = <Doc extends { id?: string }>(
  collection_path: string,
  schema: Schema.Schema<any, Doc>,
  index_string: string = ""
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonService = yield* JsonService;
    const IndexDefinitions = parseIndexString(index_string);

    const indexService = yield* makeIndexService(
      `${collection_path}/_indexes`,
      IndexDefinitions,
      schema
    );
    const metadataService = yield* makeMetadata(
      `${collection_path}/_metadata.json`
    );

    yield* fs.makeDirectory(collection_path, { recursive: true });

    const loadAll = Effect.gen(function* () {
      const files = yield* fs.readDirectory(collection_path);

      const docs = yield* Effect.all(
        files
          .filter((file) => !file.startsWith("_"))
          .map((file) =>
            fs.readFileString(`${collection_path}/${file}`).pipe(
              Effect.flatMap(jsonService.parse),
              Effect.flatMap((json) => Schema.decode(schema)(json))
            )
          )
      );
      return docs;
    }).pipe(
      Effect.mapError(
        (cause) =>
          new DatabaseError({ message: "Failed to load collection", cause })
      )
    );

    const create = (data: Doc) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID() as string;
        const document_path = `${collection_path}/${id}.json`;
        const new_document = { ...data, id };

        const encoded_content = yield* Schema.encode(schema)(new_document);
        const content = yield* jsonService.stringify({
          ...encoded_content,
          id
        });
        yield* fs.writeFileString(document_path, content);

        yield* Effect.all([
          metadataService.incrementCount,
          indexService.update(undefined, new_document)
        ]);

        return new_document;
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DatabaseError({ message: "Failed to create document", cause })
        )
      );

    const findById = (id: string) =>
      Effect.gen(function* () {
        const document_path = `${collection_path}/${id}.json`;
        const data = yield* fs.readFileString(document_path);
        const json = yield* jsonService.parse(data);
        const document = yield* Schema.decode(schema)(json);

        return document;
      }).pipe(
        Effect.catchTag("SystemError", (e) =>
          e.reason === "NotFound" ? Effect.succeed(undefined) : Effect.fail(e)
        ),
        Effect.mapError(
          (cause) =>
            new DatabaseError({
              message: `Failed to find document ${id}`,
              cause
            })
        )
      );

    const update = (id: string, data: Partial<Doc>) =>
      Effect.gen(function* () {
        const old_document = yield* findById(id);
        if (!old_document) return undefined;

        const new_document = {
          ...old_document,
          ...data
        };

        const validated_document = yield* Schema.encode(schema)(new_document);

        const content = yield* jsonService.stringify(validated_document);

        yield* fs.writeFileString(`${collection_path}/${id}.json`, content);

        yield* Effect.all([
          metadataService.touch,
          indexService.update(old_document, new_document)
        ]);
        return new_document;
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DatabaseError({
              message: `Failed to update document ${id}`,
              cause
            })
        )
      );

    const deleteFn = (id: string) =>
      Effect.gen(function* () {
        const old_document = yield* findById(id);
        if (!old_document) return false;

        yield* fs.remove(`${collection_path}/${id}.json`);

        yield* Effect.all([
          metadataService.decrementCount,
          indexService.update(old_document, undefined)
        ]);
        return true;
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DatabaseError({
              message: `Failed to delete document ${id}`,
              cause
            })
        )
      );

    const find = (options: QueryOptions<Doc>) =>
      loadAll.pipe(
        Effect.map((document) => {
          let results = document;

          if (options.where) {
            results = results.filter(options.where);
          }

          if (options.order_by) {
            const { field, order } = options.order_by;
            results = results.sort((a, b) => {
              if (a[field] < b[field]) return order === "asc" ? -1 : 1;
              if (a[field] > b[field]) return order === "asc" ? 1 : -1;
              return 0;
            });
          }

          const skip = options.skip ?? 0;
          const limit = options.limit ?? Number.POSITIVE_INFINITY;
          return results.slice(skip, skip + limit);
        })
      );

    const findStream = (options: QueryOptions<Doc>) =>
      Stream.fromEffect(fs.readDirectory(collection_path)).pipe(
        Stream.flatMap((files) => Stream.fromIterable(files)),
        Stream.mapEffect(
          (file) =>
            fs.readFileString(`${collection_path}/${file}`).pipe(
              Effect.flatMap(jsonService.parse),
              Effect.flatMap((json) => Schema.decode(schema)(json))
            ),
          { concurrency: 16 }
        ),
        (stream) =>
          options.where ? Stream.filter(stream, options.where) : stream,
        Stream.mapError(
          (cause) =>
            new DatabaseError({
              message: "Failed during stream operation",
              cause
            })
        )
      );

    const findOne = (options: QueryOptions<Doc>) =>
      find({ ...options, limit: 1 }).pipe(Effect.map((docs) => docs[0]));

    const count = metadataService.get.pipe(Effect.map((m) => m.document_count));
    const getMetadata = metadataService.get;

    return {
      create,
      findById,
      update,
      delete: deleteFn,
      find,
      findOne,
      findStream,
      count,
      getMetadata
    };
  });
