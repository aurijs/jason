# Specification: Effect.ts Integration Refactor

## 1. Goal
The objective is to fully migrate JasonDB's core logic and I/O operations to use the Effect.ts ecosystem. This will provide structured concurrency, unified error handling, and a more robust dependency injection pattern.

## 2. Requirements
- **Unified Error Handling:** Replace standard `throw` and `try/catch` blocks with `Effect.fail` and `Effect.catchAll`.
- **Structured Concurrency:** Use Effect's fibers and concurrency primitives for file I/O and cache management.
- **Dependency Injection:** Utilize `Layer` and `Context` for managing services like file system access and logging.
- **Type Safety:** Ensure all Effects are strictly typed (Success and Error types).
- **Bun Integration:** Leverage `@effect/platform-bun` for native Bun runtime capabilities.

## 3. Architecture Changes
- **Layers:** Define `FileSystem`, `Config`, and `Logger` layers.
- **Core Logic:** Update `src/core/main.ts` and `src/make/collection.ts` to return Effects.
- **Testing:** Update the test suite to use `Effect.runPromise` or equivalent for execution.

## 4. Acceptance Criteria
- [ ] All existing tests pass when run within an Effect runtime.
- [ ] Codebase is free of unhandled promises and traditional try/catch for core logic.
- [ ] `tsc` and `lint` pass with no errors.
- [ ] Documentation updated to reflect the new Effect-based API for library consumers.
