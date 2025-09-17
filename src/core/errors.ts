import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string;
  cause: unknown;
}> {}

export class JsonFileError extends Data.TaggedError("JsonFileError")<{
  message: string;
  cause: unknown;
}> {}

export class MetadataPersistenceError extends Data.TaggedError(
  "MetadataPersistenceError"
)<{
  message: string;
  cause: unknown;
}> {}

export class DocumentNotFoundError extends Data.TaggedError(
  "DocumentNotFoundError"
)<{
  message: string;
  cause: unknown;
}> {}

export class DeleteOperationError extends Data.TaggedError(
  "DeleteOperationError"
)<{
  message: string;
  cause: unknown;
}> {}

export class QueryOperationError extends Data.TaggedError(
  "QueryOperationError"
)<{
  message: string;
  cause: unknown;
}> {}

export class JsonError extends Data.TaggedError("JsonError")<{
  message: string;
  cause: unknown;
}> {}
