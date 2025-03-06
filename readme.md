# Jason Monorepo 📦

![image with the jason logo](./static/markdown-image.png)

A monorepo containing implementations of Jason, a simple, lightweight, and embeddable JSON database in multiple languages.

## 📚 Packages

### [@aurios/jason](./packages/node-jason)

A Node.js/Bun implementation of Jason database with TypeScript support. Features include:

- Schema validation
- Concurrency control
- Built-in caching
- Query system
- Document versioning

### [python-jason](./packages/python-jason)

A Python implementation of Jason database *(in development)*.

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- [Node.js](https://nodejs.org) >= 18.0.0
- [Python](https://www.python.org/) >= 3.13

### Installation

```bash
# Clone the repository
git clone https://github.com/aurijs/jason.git

# Install dependencies
bun install
```

## 🛠️ Development Scripts

- `bun run build` - Build all packages
- `bun run test` - Run tests
- `bun run lint` - Lint code
- `bun run format` - Format code using Biome
- `bun run dev` - Start development mode
- `bun run clean` - Clean build artifacts

## 📦 Package Management

This project uses [Bun](https://bun.sh) as the package manager and [Turborepo](https://turbo.build/repo) for managing the monorepo.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🔗 Links

- [GitHub Repository](https://github.com/aurijs/jason)
- [Author's Website](https://ternary.vercel.app)
- [NPM Package](https://www.npmjs.com/package/@aurios/jason)
