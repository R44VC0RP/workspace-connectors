# Contributing to Workspace Connectors

Thank you for your interest in contributing to Workspace Connectors! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/workspace-connectors.git`
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

See the [README](README.md) for detailed setup instructions including:
- Environment variables
- Google Cloud OAuth setup
- Running the development servers

## Making Changes

### Code Style

- We use TypeScript with strict mode enabled
- Follow the existing code patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic

### Commit Messages

Write clear, concise commit messages:
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Fix bug" not "Fixes bug")
- Reference issues when applicable ("Fix #123")

### Pull Requests

1. Update your fork with the latest changes from main
2. Ensure your code passes linting: `bun lint`
3. Test your changes thoroughly
4. Create a pull request with a clear description of changes

## Project Structure

```
app/           # Next.js App Router pages
convex/        # Convex backend (auth, database, HTTP endpoints)
lib/
  api/         # Elysia API routes
  services/    # Google API service wrappers
components/    # React components
```

## Areas for Contribution

- **Bug fixes** - Help us squash bugs
- **Documentation** - Improve README, add examples
- **New features** - Check issues for feature requests
- **Tests** - Add test coverage
- **Performance** - Optimize existing code

## Reporting Issues

When reporting issues, please include:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)

## Questions?

Feel free to open an issue for questions or join the discussion in existing issues.

Thank you for contributing!
