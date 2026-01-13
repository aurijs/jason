import { FileSystem } from "@effect/platform";
import type { SystemError } from "@effect/platform/Error";
import { Effect, Ref } from "effect";
import * as Schema from "effect/Schema";
import { Json } from "../layers/json.js";
import { DatabaseError } from "../core/errors.js";

const BTreeNodeSchema = <K>(key_schema: Schema.Schema<any, K>) =>
  Schema.mutable(Schema.Struct({
    id: Schema.String,
    is_leaf: Schema.Boolean,
    keys: Schema.mutable(Schema.Array(key_schema)),
    values: Schema.mutable(Schema.Array(Schema.String)),
    children: Schema.mutable(Schema.Array(Schema.String))
  }));

type BTreeNode<K> = Schema.Schema.Type<ReturnType<typeof BTreeNodeSchema<K>>>;

const RootPointerSchema = Schema.mutable(Schema.Struct({ root_id: Schema.String }));
type RootPointer = Schema.Schema.Type<typeof RootPointerSchema>;

export const makeBtreeService = <K>(
  three_path: string,
  key_schema: Schema.Schema<any, K>,
  order: number
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const jsonService = yield* Json;
    const node_schema = BTreeNodeSchema(key_schema);
    const root_pointer_path = `${three_path}/_root.json`;

    const semaphore = yield* Effect.makeSemaphore(1);

    yield* fs.makeDirectory(three_path, { recursive: true });

    const createNode = (is_leaf: boolean) =>
      Effect.sync(
        () =>
          ({
            id: crypto.randomUUID() as string,
            is_leaf,
            keys: [],
            values: [],
            children: []
          }) as BTreeNode<K>
      ).pipe(Effect.tap(writeNode));

    const readNode = (id: string) =>
      fs.readFileString(`${three_path}/${id}.json`).pipe(
        Effect.flatMap(jsonService.parse),
        Effect.flatMap((data) => Schema.decode(node_schema)(data)),
        Effect.mapError(
          (e) => new DatabaseError({ message: `Failed to read node ${id}`, cause: e })
        )
      );

    const writeNode = (node: BTreeNode<K>) =>
      Schema.encode(node_schema)(node).pipe(
        Effect.flatMap(jsonService.stringify),
        Effect.flatMap((content) =>
          fs.writeFileString(`${three_path}/${node.id}.json`, content)
        ),
        Effect.mapError(
          (e) => new DatabaseError({ message: `Failed to write node ${node.id}`, cause: e })
        )
      );

    const rootIdRef = yield* Effect.gen(function* () {
      const content = yield* fs.readFileString(root_pointer_path);
      const json = yield* jsonService.parse(content);
      const pointer = yield* Schema.decode(RootPointerSchema)(json);
      return yield* Ref.make(pointer.root_id);
    }).pipe(
      Effect.catchTag("SystemError", (e) =>
        e.reason === "NotFound"
          ? Effect.gen(function* () {
              const root_node = yield* createNode(true);
              const pointer: RootPointer = { root_id: root_node.id };
              const content = yield* jsonService.stringify(pointer);
              yield* fs.writeFileString(root_pointer_path, content);
              return yield* Ref.make(root_node.id);
            })
          : Effect.fail(e)
      )
    );

    const updateRootId = (new_root_id: string) =>
      Ref.set(rootIdRef, new_root_id).pipe(
        Effect.flatMap(() => jsonService.stringify({ root_id: new_root_id })),
        Effect.flatMap((content) =>
          fs.writeFileString(root_pointer_path, content)
        )
      );

    const splitChild = (
      parent: BTreeNode<K>,
      child_index: number,
      full_child: BTreeNode<K>
    ) =>
      Effect.gen(function* () {
        const new_sibling = yield* createNode(full_child.is_leaf);
        const median_index = order - 1;

        parent.keys.splice(child_index, 0, full_child.keys[median_index]);
        parent.values.splice(child_index, 0, full_child.values[median_index]);
        parent.children.splice(child_index + 1, 0, new_sibling.id);

        new_sibling.keys = full_child.keys.slice(median_index + 1);
        new_sibling.values = full_child.values.slice(median_index + 1);
        if (!full_child.is_leaf) {
          new_sibling.children = full_child.children.slice(median_index + 1);
        }

        full_child.keys = full_child.keys.slice(0, median_index);
        full_child.values = full_child.values.slice(0, median_index);
        if (!full_child.is_leaf) {
          full_child.children = full_child.children.slice(0, median_index + 1);
        }

        yield* Effect.all(
          [writeNode(parent), writeNode(full_child), writeNode(new_sibling)],
          { concurrency: "inherit" }
        );
      });

    const insertNonFull = (
      node: BTreeNode<K>,
      key: K,
      value: string
    ): Effect.Effect<void, DatabaseError | SystemError> =>
      Effect.gen(function* () {
        let i = node.keys.length - 1;
        if (node.is_leaf) {
          while (i >= 0 && key < node.keys[i]) {
            i--;
          }
          (node.keys as K[]).splice(i + 1, 0, key);
          (node.values as string[]).splice(i + 1, 0, value);

          yield* writeNode(node);
        } else {
          while (i >= 0 && key < node.keys[i]) {
            i--;
          }

          i++;

          let child = yield* readNode(node.children[i]);
          if (child.keys.length === 2 * order - 1) {
            yield* splitChild(node, i, child);

            if (key > node.keys[i]) {
              i++;
            }
          }

          const next_child = yield* readNode(node.children[i]);
          yield* insertNonFull(next_child, key, value);
        }
      });

    const findInNode = (
      node_id: string,
      key: K
    ): Effect.Effect<string | undefined, DatabaseError | SystemError> =>
      Effect.gen(function* () {
        const node = yield* readNode(node_id);
        let i = 0;
        while (i < node.keys.length && key > node.keys[i]) {
          i++;
        }

        if (i < node.keys.length && key === node.keys[i]) {
          return node.values[i];
        }

        if (node.is_leaf) {
          return undefined;
        }

        return yield* findInNode(node.children[i], key);
      });

    return {
      /**
       * Inserts a key-value pair into the B-tree.
       *
       * @param key The key to insert.
       * @param value The value associated with the key.
       * @returns An effect that completes when the insertion is done.
       */
      insert: (key: K, value?: string) => {
        const insert_effect = Effect.gen(function* () {
          const root_id = yield* Ref.get(rootIdRef);
          let root = yield* readNode(root_id);

          if (root.keys.length === 2 * order - 1) {
            const new_root = yield* createNode(false);
            new_root.children.push(root.id);

            yield* splitChild(new_root, 0, root);
            yield* updateRootId(new_root.id);
            yield* insertNonFull(new_root, key, value ?? "");
          } else {
            yield* insertNonFull(root, key, value ?? "");
          }
        });

        return semaphore.withPermits(1)(insert_effect);
      },
      /**
       * Finds the value associated with a given key in the B-tree.
       * @param key The key to search for.
       * @returns - The value associated with the key, or undefined if not found.
       */
      find: (key: K) => {
        const find_effect = Ref.get(rootIdRef).pipe(
          Effect.flatMap((rootId) => findInNode(rootId, key))
        );

        return semaphore.withPermits(1)(find_effect);
      }
    };
  });
