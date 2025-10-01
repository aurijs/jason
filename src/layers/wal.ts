import { Path } from "@effect/platform";
import { Effect, Layer } from "effect";
import { makeWal } from "../make/wal.js";
import { ConfigService } from "../services/config.js";
import { WALService } from "../services/wal.js";

export const WALServiceLive = Layer.scoped(
  WALService,
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const config = yield* ConfigService;

    const db_path = yield* config.getBasePath;
    const wal_path = path.join(db_path, "_wal"); // database root

    const MAX_SEGMENT_SIZE = 16 * 1024 * 1024; // 16MB

    return yield* makeWal(wal_path, MAX_SEGMENT_SIZE);
  })
);
