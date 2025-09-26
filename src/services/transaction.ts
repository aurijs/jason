import type { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Context, type Effect } from "effect";
import type { ConfigService } from "./config.js";

export interface ITransaction {
  readonly writeFile: (
    relative_path: string,
    content: Buffer | string
  ) => Effect.Effect<void, PlatformError>;
  readonly removeFile: (
    relative_path: string
  ) => Effect.Effect<void, PlatformError>;
}

export class Transaction extends Context.Tag("Transaction")<
  Transaction,
  ITransaction
>() {}

export interface ITransactionManager {
  readonly withTransaction: <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<
    A,
    E | Error,
    Exclude<R, Transaction> | FileSystem.FileSystem | Path.Path | ConfigService
  >;
}

export class TransactionManager extends Context.Tag("TransactionManager")<
  TransactionManager,
  ITransactionManager
>() {}
