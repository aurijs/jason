import { Layer, PubSub } from "effect";
import { WalChannel } from "../services/wal-channel.js";
import type { WALOperation } from "../types/wal.js";

export const WalChannelLive = Layer.effect(
  WalChannel,
  PubSub.unbounded<WALOperation>()
);
