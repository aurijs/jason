# Technology Stack: JasonDB

This document outlines the primary technologies, frameworks, and tools used in the development of JasonDB.

## Runtime & Language
- **Runtime:** [Bun](https://bun.sh/) - Native runtime environment for performance and modern developer experience.
- **Language:** [TypeScript](https://www.typescriptlang.org/) - Ensuring type safety and robust development.

## Core Architecture
- **Framework:** [Effect](https://effect.website/) - Utilizing the Effect ecosystem (`effect`, `@effect/platform`) for structured concurrency, error handling, and dependency injection.

## Development Tools
- **Build Tool:** [Tsup](https://tsup.egoist.dev/) - Fast TypeScript bundler.
- **Testing:** [Vitest](https://vitest.dev/) - Next-generation testing framework.
- **Linting & Formatting:** [Biome](https://biomejs.dev/) - One toolchain for web projects (replaces Prettier/ESLint).

## Key Patterns
- **Functional Programming:** Leveraging Effect for pure, composable logic.
- **Native Bun APIs:** Using Bun-specific APIs for file system and performance-critical operations.
