import { Data } from "effect";

export class WalWriteError extends Data.TaggedError("WalWriteError")<{
  readonly reason: "SerializationError" | "FileSystemError";
  readonly cause: unknown;
}> {}

export class WalReplayError extends Data.TaggedError("WalReplayError")<{
  readonly reason: "DirectoryReadError" | "FileReadError" | "ParseError";
  readonly cause: unknown;
}> {}

export class WalCheckpointError extends Data.TaggedError("WalCheckpointError")<{
  readonly reason: "DirectoryReadError" | "FileRemoveError";
  readonly cause: unknown;
}> {}

export class WalInitializationError extends Data.TaggedError(
  "WalInitializationError"
)<{
  readonly reason: "DirectoryCreationError" | "DirectoryReadError";
  readonly cause: unknown;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class JsonFileError extends Data.TaggedError("JsonFileError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class MetadataPersistenceError extends Data.TaggedError(
  "MetadataPersistenceError"
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class DocumentNotFoundError extends Data.TaggedError(
  "DocumentNotFoundError"
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class DeleteOperationError extends Data.TaggedError(
  "DeleteOperationError"
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class QueryOperationError extends Data.TaggedError(
  "QueryOperationError"
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class JsonError extends Data.TaggedError("JsonError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}
