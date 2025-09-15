import { FileSystem } from "@effect/platform";
import { Effect, Schema, Stream } from "effect";
import { DatabaseError } from "../core/errors.js";
import { makeMetadata } from "../layers/metadata.js";
import type { QueryOptions } from "../types/collection.js";
import { JsonService } from "./json.js";
import { makeIndexService } from "../layers/index.js";

function parseIndexString(index_string: string) {
  return {};
}

export const makeCollection = <Doc extends { id: string }>(
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

    const create = (data: Omit<Doc, "id">) =>
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
