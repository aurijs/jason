# Contributing to Jason

Thank you for your interest in contributing to Jason! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Guidelines](#commit-guidelines)
  - [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Bun](https://bun.sh) >= 1.0.0
- [Node.js](https://nodejs.org) >= 18.0.0
- [Python](https://www.python.org/) >= 3.13 (for Python package development)

### Setup

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR-USERNAME/jason.git
   cd jason
   ```

3. Add the original repository as an upstream remote:

   ```bash
   git remote add upstream https://github.com/aurijs/jason.git
   ```

4. Install dependencies:

   ```bash
   bun install
   ```

## Development Workflow

### Branching Strategy

- `main` - Contains the stable version of the code
- `dev` - Development branch where features are integrated before release
- For new features or bug fixes, create a branch from `dev` with a descriptive name:
  - Feature branches: `feature/your-feature-name`
  - Bug fix branches: `fix/issue-description`

### Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages:

```git
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types include:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Changes to the build process or auxiliary tools

Examples:

```git
feat(node): add new query method
fix(python): resolve concurrency issue
docs: update API documentation
```

### Pull Request Process

1. Update your fork to the latest upstream changes:

   ```bash
   git fetch upstream
   git checkout dev
   git merge upstream/dev
   ```

2. Create your feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes and commit them using the commit guidelines

4. Push to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

5. Open a pull request against the `dev` branch

6. Ensure your PR includes:
   - A clear description of the changes
   - Any related issue numbers
   - Tests for new functionality
   - Updated documentation

7. Address any feedback from code reviews

## Coding Standards

- We use [Biome](https://biomejs.dev/) for code formatting and linting
- Run formatting before committing:

  ```bash
  bun run format
  ```

- Run linting to check for issues:

  ```bash
  bun run lint
  ```

### TypeScript Guidelines

- Use explicit types where possible
- Follow interface-first design principles
- Document public APIs with JSDoc comments

### Python Guidelines

- Follow PEP 8 style guide
- Use type hints
- Write docstrings for functions and classes

## Testing

- Write tests for all new features and bug fixes
- Ensure all tests pass before submitting a PR:

  ```bash
  bun run test
  ```

- Aim for high test coverage of your code

## Documentation

- Update documentation for any changed functionality
- Document new features, options, and APIs
- Keep README.md and other documentation files up to date

## Issue Reporting

When reporting issues, please use one of the provided issue templates and include:

- A clear, descriptive title
- A detailed description of the issue
- Steps to reproduce the problem
- Expected and actual behavior
- Environment information (OS, Node.js/Bun version, etc.)
- Screenshots if applicable

---

Thank you for contributing to Jason! Your efforts help make this project better for everyone.
