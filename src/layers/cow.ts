import { FileSystem, Path } from "@effect/platform";
import { Effect, Exit, Layer, Scope } from "effect";
import { ConfigService } from "../services/config.js";
import { CowService, type CowTransaction } from "../services/cow.js";

type InternalCowTransaction = CowTransaction & {
  readonly _tx_path: string;
};

export const CowLive = Layer.scoped(
  CowService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const config = yield* ConfigService;
    const scope = yield* Scope.Scope;

    const db_path = yield* config.getBasePath;
    const staging_path = path.join(db_path, "_staging");

    yield* fs.makeDirectory(staging_path, { recursive: true });

    const begin = Effect.acquireRelease(
      Effect.gen(function* () {
        const tx_id = crypto.randomUUID();
        const tx_path = path.join(staging_path, tx_id);
        yield* fs.makeDirectory(tx_path);

        const transaction: InternalCowTransaction = {
          writeFile: (relative_path: string, content: any) =>
            fs.writeFile(path.join(tx_path, relative_path), content),
          removeFile: (relative_path: string) =>
            fs.remove(path.join(tx_path, relative_path)),
          _tx_path: tx_path
        };
        return transaction;
      }),
      (tx, exit) =>
        Exit.isFailure(exit)
          ? fs.remove(tx._tx_path, { recursive: true }).pipe(Effect.orDie)
          : Effect.void
    ).pipe((effect) =>
      Effect.provide(effect, Layer.succeed(Scope.Scope, scope))
    );

    const commit = (tx: CowTransaction) =>
      Effect.gen(function* () {
        const tx_path = (tx as InternalCowTransaction)._tx_path;

        const temp_final_path = path.join(db_path, "_new");
        yield* fs.rename(tx_path, temp_final_path);
        yield* fs.rename(db_path, path.join(db_path, "_old"));
        yield* fs.rename(temp_final_path, db_path);
        yield* fs.remove(path.join(db_path, "_old"), { recursive: true });
      });

    return {
      begin,
      commit
    };
  })
);
