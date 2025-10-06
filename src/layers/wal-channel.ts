import { Effect, PubSub } from "effect";
import type { WALOperation } from "../types/wal.js";

export class WalChannel extends Effect.Service<WalChannel>()("WalChannel", {
  effect: PubSub.unbounded<WALOperation>()
}) {}
