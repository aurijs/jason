import { Schema } from "effect";

export class WalWriteError extends Schema.TaggedError<WalWriteError>()(
  "WalWriteError",
  {
    reason: Schema.Union(
      Schema.Literal("SerializationError"),
      Schema.Literal("FileSystemError")
    ),
    cause: Schema.Unknown
  }
) {}

export class WalReplayError extends Schema.TaggedError<WalReplayError>()(
  "WalReplayError",
  {
    reason: Schema.Union(
      Schema.Literal("DirectoryReadError"),
      Schema.Literal("FileReadError"),
      Schema.Literal("ParseError")
    ),
    cause: Schema.Unknown
  }
) {}

export class WalCheckpointError extends Schema.TaggedError<WalCheckpointError>()(
  "WalCheckpointError",
  {
    reason: Schema.Union(
      Schema.Literal("DirectoryReadError"),
      Schema.Literal("FileRemoveError")
    ),
    cause: Schema.Unknown
  }
) {}

export class WalInitializationError extends Schema.TaggedError<WalInitializationError>()(
  "WalInitializationError",
  {
    reason: Schema.Union(
      Schema.Literal("DirectoryCreationError"),
      Schema.Literal("DirectoryReadError")
    ),
    cause: Schema.Unknown
  }
) {}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

export class JsonFileError extends Schema.TaggedError<JsonFileError>()(
  "JsonFileError",
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

export class MetadataPersistenceError extends Schema.TaggedError<MetadataPersistenceError>()(
  "MetadataPersistenceError",
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

export class DocumentNotFoundError extends Schema.TaggedError<DocumentNotFoundError>()(
  "DocumentNotFoundError",
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

export class DeleteOperationError extends Schema.TaggedError<DeleteOperationError>()(
  "DeleteOperationError",
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

export class QueryOperationError extends Schema.TaggedError<QueryOperationError>()(
  "QueryOperationError",
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

export class JsonError extends Schema.TaggedError<JsonError>()("JsonError", {
  message: Schema.String,
  cause: Schema.Unknown
}) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    issues: Schema.Array(Schema.Any)
  }
) {}

export const CoreError = Schema.Union(
  WalWriteError,
  WalReplayError,
  WalCheckpointError,
  WalInitializationError,
  DatabaseError,
  JsonFileError,
  MetadataPersistenceError,
  DocumentNotFoundError,
  DeleteOperationError,
  QueryOperationError,
  JsonError,
  ValidationError
);

export type CoreError = Schema.Schema.Type<typeof CoreError>;
