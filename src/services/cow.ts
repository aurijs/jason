import type { PlatformError } from "@effect/platform/Error";
import { Context, type Effect } from "effect";

export interface CowTransaction {
  readonly writeFile: (
    relative_path: string,
    content: Buffer | string
  ) => Effect.Effect<void, PlatformError>;

  readonly removeFile: (
    relative_path: string
  ) => Effect.Effect<void, PlatformError>;
}

export interface ICowService {
  readonly begin: Effect.Effect<CowTransaction, PlatformError>;
  readonly commit: (tx: CowTransaction) => Effect.Effect<void, Error>;
}

export class CowService extends Context.Tag("CowService")<
  CowService,
  ICowService
>() {}
