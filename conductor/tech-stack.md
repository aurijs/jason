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
- **Linting & Formatting:** [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) - High-performance JavaScript linter.

## Key Patterns
- **Functional Programming:** Leveraging Effect for pure, composable logic.
- **Platform Agnostic I/O:** Using `@effect/platform` to support multiple runtimes (Bun, Node.js) through a unified FileSystem abstraction.
