import type { PlatformError } from "@effect/platform/Error";
import { Context, type Effect } from "effect";

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
