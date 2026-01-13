# Plan: Standard Schema Support

## Phase 1: Infrastructure & Type Support
- [ ] Task: Define Standard Schema Types
    - [ ] Add `StandardSchemaV1` interface and namespace to `src/types/schema.ts` (B - Internal implementation).
    - [ ] Update `SchemaOrString` to include `StandardSchemaV1`.
- [ ] Task: Update Type Inference
    - [ ] Update `InferCollections` in `src/types/collection.ts` to infer the output type `A` from a Standard Schema using its `types` property or the return type of `validate`.
- [ ] Task: Conductor - User Manual Verification 'Infrastructure & Type Support' (Protocol in workflow.md)

## Phase 2: Configuration & ConfigManager
- [ ] Task: Update ConfigManager to Support Standard Schema
    - [ ] In `src/layers/config.ts`, update `ConfigManager` to handle Standard Schema in the `collections` config.
    - [ ] Ensure `getCollectionSchema` can return either an Effect Schema or a Standard Schema (may need to update return type to a union or a generic wrapper).
- [ ] Task: Test Configuration with Standard Schema
    - [ ] Create tests to verify that `ConfigManager` correctly identifies and stores Standard Schemas.
- [ ] Task: Conductor - User Manual Verification 'Configuration & ConfigManager' (Protocol in workflow.md)

## Phase 3: Runtime Validation & Integration
- [ ] Task: Refactor JsonFile Layer
    - [ ] Modify `src/layers/json-file.ts` to handle both Effect Schemas and Standard Schemas.
    - [ ] Since Standard Schema lacks a native `encode`, implement a fallback to identity for serialization when a Standard Schema is used.
- [ ] Task: Integrate Validation in StorageManager/Collection
    - [ ] Ensure `makeStorageManager` and `makeCollection` trigger the correct validation logic.
    - [ ] Implement error pass-through: if a Standard Schema `validate` fails, return its issues/errors directly.
- [ ] Task: Conductor - User Manual Verification 'Runtime Validation & Integration' (Protocol in workflow.md)

## Phase 4: Final Verification & Testing
- [ ] Task: Write Integration Test with Zod
    - [ ] Create `test/standard-schema.test.ts`.
    - [ ] Implement tests using `zod` to verify collection creation, document insertion, and update validation with error pass-through.
- [ ] Task: Final Quality Gates
    - [ ] Run `bun run lint` and `bun x tsc --noEmit`.
    - [ ] Run `bun test` and verify coverage > 80%.
- [ ] Task: Conductor - User Manual Verification 'Final Verification & Testing' (Protocol in workflow.md)
