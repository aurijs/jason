import { Context, type PubSub } from "effect";
import type { WALOperation } from "../types/wal.js";

// oxlint-disable-next-line namespace
export interface IWalChannel extends PubSub.PubSub<WALOperation> {}

export class WalChannel extends Context.Tag("WalChannel")<
  WalChannel,
  IWalChannel
>() {}
