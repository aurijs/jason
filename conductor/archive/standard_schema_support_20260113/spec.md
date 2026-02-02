# Specification: Standard Schema Support

## Overview
Enable developers to use any validation library that implements the `@standard-schema/spec` (e.g., Zod, Valibot, ArkType) for defining collection schemas in JasonDB. This removes the hard dependency on Effect Schema for data validation while maintaining type safety.

## Functional Requirements
- **Update Configuration:** Modify `JasonDBConfig` and `ConfigManager` to accept `@standard-schema/spec` compliant validators in the `collections` object.
- **Runtime Validation:**
  - Update `makeStorageManager` and `makeCollection` to detect if a schema is a "Standard Schema".
  - If a Standard Schema is used, invoke its validation logic during `create` and `update` operations.
- **Error Handling:** If validation fails, pass the original error from the validation library (e.g., `ZodError`) back to the caller.
- **Type Compatibility:** Ensure that `Doc` types can be correctly inferred from the Standard Schema validator.

## Non-Functional Requirements
- **Low Overhead:** Ensure the detection and invocation of Standard Schemas adds minimal latency.
- **Developer Flexibility:** Allow mixing of Effect Schemas and Standard Schemas across different collections in the same database instance.

## Acceptance Criteria
- [ ] `createJasonDB` accepts a config with a Zod or Valibot schema.
- [ ] `collection.create()` and `collection.update()` trigger validation using the provided Standard Schema.
- [ ] Validation failures result in the library-specific error being returned/thrown.
- [ ] TypeScript correctly infers the document type from the Standard Schema.
- [ ] Unit tests demonstrate support for at least one major standard-schema-compliant library (e.g., Zod).

## Out of Scope
- Automatic conversion between Effect Schemas and Standard Schemas.
- Support for libraries that do *not* implement the `@standard-schema/spec`.
