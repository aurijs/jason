# Plan: Effect.ts Integration Refactor

## Phase 1: Foundation and Infrastructure [checkpoint: 9eb0421]
- [x] Task: Define Core Error Schema using Effect.ts Schema b0e8d05
- [x] Task: Write Tests for Error Schema b0e8d05
- [x] Task: Implement Error Schema b0e8d05
- [x] Task: Define FileSystem and Config Layers b0e8d05
- [x] Task: Write Tests for Layers b0e8d05
- [x] Task: Implement Layers b0e8d05
- [ ] Task: Conductor - User Manual Verification 'Foundation and Infrastructure' (Protocol in workflow.md)

## Phase 2: Core Logic Refactoring
- [ ] Task: Refactor Storage Manager to use Effect - [ ] Task: Write Tests for Storage Manager - [ ] Task: Implement Refactor
- [ ] Task: Refactor BTree implementation to use Effect - [ ] Task: Write Tests for BTree - [ ] Task: Implement Refactor
- [ ] Task: Conductor - User Manual Verification 'Core Logic Refactoring' (Protocol in workflow.md)

## Phase 3: Collection and Query API
- [ ] Task: Refactor Collection CRUD operations to return Effects - [ ] Task: Write Tests for Collection - [ ] Task: Implement Refactor
- [ ] Task: Refactor Query engine to use Effect - [ ] Task: Write Tests for Query - [ ] Task: Implement Refactor
- [ ] Task: Conductor - User Manual Verification 'Collection and Query API' (Protocol in workflow.md)

## Phase 4: Final Integration and Cleanup
- [ ] Task: Update Main Entry point (JasonDB class) to Effect-based API - [ ] Task: Write Tests for Entry Point - [ ] Task: Implement Refactor
- [ ] Task: Final project-wide lint and type check - [ ] Task: Run `bun run lint` and `bun x tsc --noEmit`
- [ ] Task: Conductor - User Manual Verification 'Final Integration and Cleanup' (Protocol in workflow.md)
