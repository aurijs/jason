import { Path } from "@effect/platform";
import { Effect } from "effect";
import { makeWal } from "../make/wal.js";
import { ConfigManager } from "./config.js";
import { NodeContext } from "@effect/platform-node";
import { Json } from "./json.js";

export class WriteAheadLog extends Effect.Service<WriteAheadLog>()("WriteAheadLog", {
  dependencies: [NodeContext.layer, Json.Default],
  scoped: Effect.gen(function* () {
    const path = yield* Path.Path;
    const config = yield* ConfigManager;
    const db_path = yield* config.getBasePath;
    const wal_path = path.join(db_path, "_wal"); // database root
    const MAX_SEGMENT_SIZE = 1024 * 1024; // 1MB
    return yield* makeWal(wal_path, MAX_SEGMENT_SIZE);
  })
}) {}
