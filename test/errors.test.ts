import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WalWriteError, CoreError } from "../src/core/errors.js";

describe("Core Errors Schema", () => {
  it("should be able to encode and decode WalWriteError", () => {
    const error = new WalWriteError({
      reason: "SerializationError",
      cause: "some cause"
    });

    const encoded = Schema.encodeSync(WalWriteError)(error);
    expect(encoded).toEqual({
      _tag: "WalWriteError",
      reason: "SerializationError",
      cause: "some cause"
    });

    const decoded = Schema.decodeSync(WalWriteError)(encoded);
    expect(decoded).toBeInstanceOf(WalWriteError);
    expect(decoded.reason).toBe("SerializationError");
  });

  it("should be able to encode and decode CoreError union", () => {
    const error = new WalWriteError({
      reason: "FileSystemError",
      cause: "disk full"
    });

    const encoded = Schema.encodeSync(CoreError)(error);
    const decoded = Schema.decodeSync(CoreError)(encoded);
    
    expect(decoded).toBeInstanceOf(WalWriteError);
    if (decoded._tag === "WalWriteError") {
        expect(decoded.reason).toBe("FileSystemError");
    }
  });
});