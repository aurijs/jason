import { FileSystem } from "@effect/platform";
import { Effect, Schema, Stream } from "effect";
import { DatabaseError } from "../core/errors.js";
import type { QueryOptions } from "../types/collection.js";

export const makeCollection = <Document>(
  collection_path: string,
  schema: Schema.Schema<any, any>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    yield* fs.makeDirectory(collection_path, { recursive: true });

    const loadAll = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const files = yield* fs.readDirectory(collection_path);

      const docs = yield* Effect.all(
        files.map((file) =>
          fs.readFileString(`${collection_path}/${file}`).pipe(
            Effect.flatMap((content) => Effect.try(() => JSON.parse(content))),
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

    const create = (data: Omit<Document, "id">) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const document_path = `${collection_path}/${id}.json`;
        const document = { ...data, id } as Document;

        const encoded_content = yield* Schema.encode(schema)(document);
        const content = JSON.stringify(encoded_content);
        yield* fs.writeFileString(document_path, content);

        return document;
      });

    const findById = (id: string) =>
      Effect.gen(function* () {
        const document_path = `${collection_path}/${id}.json`;
        const data = yield* fs.readFileString(document_path);
        const json = JSON.parse(data) as Document;
        const document = yield* Schema.decode(schema)(json);

        return document;
      });

    const update = (id: string, data: Partial<Document>) =>
      Effect.gen(function* () {
        const existing_document = yield* findById(id);
        if (!existing_document) return undefined;

        const updated_document = {
          ...existing_document,
          ...data
        };

        const validated_document =
          yield* Schema.decode(schema)(updated_document);

        const content = JSON.stringify(validated_document);

        yield* fs.writeFileString(`${collection_path}/${id}.json`, content);

        return validated_document;
      });

    const deleteFn = (id: string) =>
      Effect.gen(function* () {
        const file_path = `${collection_path}/${id}.json`;
        const exist = yield* fs.exists(file_path);
        if (!exist) return false;
        yield* fs.remove(file_path);
        return true;
      });

    const find = (options: QueryOptions<Document>) =>
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

    const findStream = (options: QueryOptions<Document>) =>
      Stream.fromEffect(fs.readDirectory(collection_path)).pipe(
        Stream.flatMap((files) => Stream.fromIterable(files)),
        Stream.mapEffect((file) =>
          fs.readFileString(`${collection_path}/${file}`).pipe(
            Effect.flatMap((content) => Effect.try(() => JSON.parse(content))),
            Effect.flatMap((json) => Schema.decode(schema)(json))
          )
        ),
        (stream) =>
          options.where ? Stream.filter(stream, options.where) : stream
      );

    const findOne = (options: QueryOptions<Document>) =>
      find({ ...options, limit: 1 }).pipe(Effect.map((docs) => docs[0]));

    return {
      create,
      findById,
      update,
      delete: deleteFn,
      find,
      findOne,
      findStream
    };
  });
