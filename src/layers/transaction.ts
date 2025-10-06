import { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Exit, Layer } from "effect";
import { Transaction, type ITransaction } from "../services/transaction.js";
import { ConfigManager } from "./config.js";

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

export class TransactionManagerLive extends Effect.Service<TransactionManagerLive>()(
  "TransactionManagerLive",
  {
    dependencies: [BunContext.layer],
    scoped: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const config = yield* ConfigManager;

      const db_path = yield* config.getBasePath;
      const staging_path = path.join(db_path, "_staging");

      yield* fs.makeDirectory(staging_path, { recursive: true });

      return {
        withTransaction: <A, E, R>(self: Effect.Effect<A, E, R>) =>
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
          )
      };
    })
  }
) {}
