import { BunFileSystem } from "@effect/platform-bun";
import { Effect, Layer, Ref, Stream } from "effect";
import { makeCollection } from "../services/collection.js";
import { ConfigService } from "../services/config.js";
import { StateService } from "../services/state.js";
import { WalChannel } from "../services/wal-channel.js";
import { WALService } from "../services/wal.js";
import type { CollectionEffect } from "../types/collection.js";
import type { WALOperation } from "../types/wal.js";
import { JsonFileLive } from "./json-file.js";
import { JsonLive } from "./json.js";
import { CowService } from "../services/cow.js";

export const StateLive = Layer.scoped(
  StateService,
  Effect.gen(function* () {
    const wal = yield* WALService;
    const channel = yield* WalChannel;

    const config = yield* ConfigService;

    const collection_depedencies = Layer.mergeAll(
      JsonFileLive,
      JsonLive,
      BunFileSystem.layer,
      Layer.succeed(ConfigService, config)
    );

    const buildAndProvideCollection = (name: string) =>
      makeCollection(name).pipe(Effect.provide(collection_depedencies));

    const collections_ref = yield* Ref.make<Map<string, CollectionEffect<any>>>(
      new Map()
    );

    const apply = (op: WALOperation) =>
      Effect.gen(function* () {

        const collections = yield* Ref.get(collections_ref);
        let collection_service = collections.get(op.collection);

        if (collection_service) {
          switch (op._tag) {
            case "CreateOp":
              yield* collection_service?.create(op.data);
              break;
            case "UpdateOp":
              yield* collection_service?.update(op.id, op.data);
              break;
          }
        } else {
          collection_service = yield* buildAndProvideCollection(op.collection);
          yield* Ref.update(collections_ref, (m) =>
            m.set(op.collection, collection_service as CollectionEffect<any>)
          );
        }
      }).pipe(
        Effect.mapError(
          (e) => new Error("Fail while applying WAL operation", { cause: e })
        )
      );

    yield* Stream.runForEach(wal.replay, ({ op }) => apply(op));

    const applier_effect = Stream.fromPubSub(channel).pipe(
      Stream.runForEach((op) =>
        apply(op).pipe(
          Effect.catchAll((error) =>
            Effect.logError("Error while applying WAL operation:", error)
          )
        )
      )
    );

    yield* Effect.forkScoped(applier_effect);

    const getCollection = (name: string) =>
      Ref.get(collections_ref).pipe(
        Effect.flatMap((collections) => {
          const collection = collections.get(name);
          return collection
            ? Effect.succeed(collection)
            : Effect.fail(new Error(`Collection ${name} not found`));
        })
      );

    return {
      apply,
      getCollection
    };
  })
);
