import { Context, Effect } from "effect";

export class WriterConfig extends Context.Tag("WriterConfig")<
  WriterConfig,
  { readonly basePath: string }
>() {}

export class WriterService extends Context.Tag("WriterService")<
  WriterService,
  {
    readonly write: (fileName: string, data: string) => Effect.Effect<void, Error>;
  }
>() {}