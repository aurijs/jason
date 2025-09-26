import { FileSystem, Path } from "@effect/platform";
import { Effect, Exit, Layer } from "effect";
import { ConfigService } from "../services/config.js";
import {
  Transaction,
  TransactionManager,
  type ITransaction
} from "../services/transaction.js";
import { BunFileSystem } from "@effect/platform-bun";

export const TransactionLive = (tx_path: string) =>
  Layer.effect(
    Transaction,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const transaction_service: ITransaction = {
        writeFile: (relative_path: string, content: any) =>
          fs.writeFile(path.join(tx_path, relative_path), content),
        removeFile: (relative_path: string) =>
          fs.remove(path.join(tx_path, relative_path))
      };

      return transaction_service;
    })
  );

export const TransactionManagerLive = Layer.scoped(
  TransactionManager,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const config = yield* ConfigService;

    const db_path = yield* config.getBasePath;
    const staging_path = path.join(db_path, "_staging");

    yield* fs.makeDirectory(staging_path, { recursive: true });

    const withTransaction = <A, E, R>(self: Effect.Effect<A, E, R>) =>
      Effect.scoped(
        Effect.gen(function* () {
          const tx_context = yield* Effect.acquireRelease(
            Effect.gen(function* () {
              const tx_id = crypto.randomUUID();
              const tx_path = path.join(staging_path, tx_id);
              yield* fs.makeDirectory(tx_path);

              const tx_layer = TransactionLive(tx_path);
              return { tx_path, tx_layer };
            }),
            ({ tx_path }, exit) =>
              Exit.isFailure(exit)
                ? fs.remove(tx_path, { recursive: true }).pipe(Effect.orDie)
                : Effect.void
          );

          // provides tx layer
          const result = yield* Effect.provide(self, tx_context.tx_layer);

          const temp_final_path = path.join(db_path, "_new");
          yield* fs.rename(tx_context.tx_path, temp_final_path);
          yield* fs.rename(db_path, path.join(db_path, "_old"));
          yield* fs.rename(temp_final_path, db_path);
          yield* fs.remove(path.join(db_path, "_old"), { recursive: true });

          return result;
        })
      );

    return {
      withTransaction
    };
  })
).pipe(
  Layer.provide(Layer.mergeAll(BunFileSystem.layer, Path.layer))
);
