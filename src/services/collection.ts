import { Effect, Schema, type Schedule } from "effect";
import type { DatabaseError } from "../core/errors.js";
import { FileSystem } from "@effect/platform";

export interface Colleciton<Document extends { id: string }> {
  readonly create: (
    data: Omit<Document, "id">
  ) => Effect.Effect<Document | undefined, DatabaseError>;
}

export const makeCollection = <Document extends { id: string }>(
  collection_path: string,
  schema: Schema.Schema<any, any>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    yield* fs.makeDirectory(collection_path, { recursive: true });

    const create = (data: Omit<Document, "id">) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const document_path = `${collection_path}/${id}.json`;
        const document = { ...data, id } as Document;

        const content = JSON.stringify(document);
        yield* fs.writeFileString(document_path, content);

        return document;
      });

    const read = (id: string) => Effect.gen(function* () {
      const document_path = `${collection_path}/${id}.json`;
      const data = yield* fs.readFileString(document_path);

      const document = JSON.parse(data) as Document;
      return document;
    })



    return { create, read };
  });
