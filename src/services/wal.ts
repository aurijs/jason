import { Context, Stream, type Effect } from "effect";
import type { WALOperation } from "../types/wal.js";

export interface IWALService {
  /**
   * Durably logs a database operation by appending it to the write-ahead log.
   *
   * @param op The operation to be logged.
   * @returns An Effect that resolves with the segment number and the final write position,
   * which are crucial for checkpointing.
   */
  readonly log: (op: WALOperation) => Effect.Effect<
    {
      segment: number;
      position: bigint;
    },
    Error
  >;

  /**
   * Reads the entire WAL history, replaying operations segment by segment in order.
   *
   * @returns A Stream of operations that the Applier can process during initialization
   * to restore the database state.
   */
  readonly replay: Stream.Stream<
    { op: WALOperation; segment: number; position: bigint },
    Error
  >;

  /**
   * Performs a checkpoint by removing all log segments up to and
   * including the specified segment number.
   *
   * This consolidates the database state and frees up space.
   */
  readonly checkpoint: (up_to_segment: number) => Effect.Effect<void, Error>;
}

export class WALService extends Context.Tag("WALService")<
  WALService,
  IWALService
>() {}
