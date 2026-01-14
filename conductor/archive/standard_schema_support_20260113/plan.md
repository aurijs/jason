# Plan: Standard Schema Support

## Phase 1: Infrastructure & Type Support (Checkpoint: c68e619)
- [x] Task: Define Standard Schema Types (c68e619)
    - [x] Add `StandardSchemaV1` interface and namespace to `src/types/schema.ts` (B - Internal implementation).
    - [x] Update `SchemaOrString` to include `StandardSchemaV1`.
- [x] Task: Update Type Inference (c68e619)
    - [x] Update `InferCollections` in `src/types/collection.ts` to infer the output type `A` from a Standard Schema using its `types` property or the return type of `validate`.
- [x] Task: Conductor - User Manual Verification 'Infrastructure & Type Support' (Protocol in workflow.md) (c68e619)

## Phase 2: Configuration & ConfigManager (Checkpoint: c68e619)
- [x] Task: Update ConfigManager to Support Standard Schema (c68e619)
    - [x] In `src/layers/config.ts`, update `ConfigManager` to handle Standard Schema in the `collections` config.
    - [x] Ensure `getCollectionSchema` can return either an Effect Schema or a Standard Schema (may need to update return type to a union or a generic wrapper).
- [x] Task: Test Configuration with Standard Schema (c68e619)
    - [x] Create tests to verify that `ConfigManager` correctly identifies and stores Standard Schemas.
- [x] Task: Conductor - User Manual Verification 'Configuration & ConfigManager' (Protocol in workflow.md) (c68e619)

## Phase 3: Runtime Validation & Integration (Checkpoint: 85d2b2b)
- [x] Task: Refactor JsonFile Layer (85d2b2b)
    - [x] Modify `src/layers/json-file.ts` to handle both Effect Schemas and Standard Schemas.
    - [x] Since Standard Schema lacks a native `encode`, implement a fallback to identity for serialization when a Standard Schema is used.
- [x] Task: Integrate Validation in StorageManager/Collection (85d2b2b)
    - [x] Ensure `makeStorageManager` and `makeCollection` trigger the correct validation logic.
    - [x] Implement error pass-through: if a Standard Schema `validate` fails, return its issues/errors directly.
- [x] Task: Conductor - User Manual Verification 'Runtime Validation & Integration' (Protocol in workflow.md) (85d2b2b)

## Phase 4: Final Verification & Testing (Checkpoint: 85d2b2b)
- [x] Task: Write Integration Test with Zod (85d2b2b)
    - [x] Create `test/standard-schema.test.ts`.
    - [x] Implement tests using `zod` to verify collection creation, document insertion, and update validation with error pass-through.
- [x] Task: Final Quality Gates (85d2b2b)
    - [x] Run `bun run lint` and `bun x tsc --noEmit`.
    - [x] Run `bun test` and verify coverage > 80%.
- [x] Task: Conductor - User Manual Verification 'Final Verification & Testing' (Protocol in workflow.md) (85d2b2b)