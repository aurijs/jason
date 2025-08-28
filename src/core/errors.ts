import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string;
  cause: Error;
}> {}

export class MetadataPersistenceError extends Data.TaggedError(
  "MetadataPersistenceError"
)<{
  message: string;
  cause: Error;
}> {}

export class DocumentNotFoundError extends Data.TaggedError(
  "DocumentNotFoundError"
)<{
  message: string;
  cause: Error;
}> {}

export class DeleteOperationError extends Data.TaggedError(
  "DeleteOperationError"
)<{
  message: string;
  cause: Error;
}> {}

export class QueryOperationError extends Data.TaggedError(
  "QueryOperationError"
)<{
  message: string;
  cause: Error;
}> {}
