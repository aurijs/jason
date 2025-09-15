import { Effect } from "effect";
import type { IndexDefinition } from "../types/metadata.js";
import { FileSystem } from "@effect/platform";
import { JsonService } from "./json.js";

export const makeIndex = <Doc extends { id: string }>(
  index_path: string,
  index_definitions: Record<string, IndexDefinition>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonService = yield* JsonService;

    yield* fs.makeDirectory(index_path, { recursive: true });

    const update = (old_doc: Doc | undefined, new_doc: Doc | undefined) => Effect.succeed('');

    const findIds = (field_name: string, value: unknown) => {};

    return { update, findIds };
  });
