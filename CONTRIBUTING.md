# Contributing to Shadow Squad

Thanks for taking the time to contribute! This guide explains how to work on the project and what we expect in pull requests.

## Getting Started

1. Fork the repository and create a feature branch
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests and linting before opening a PR:
   ```bash
   npm run lint
   npm test
   ```
4. For end-to-end tests (requires Playwright):
   ```bash
   npx playwright install chromium
   npm run test:e2e
   ```

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/). Every commit must follow the format:

```
type(scope): short description
```

### Allowed Types

| Type       | Description                                      |
|------------|--------------------------------------------------|
| `feat`     | A new feature                                    |
| `fix`      | A bug fix                                        |
| `docs`     | Documentation only changes                       |
| `style`    | Code style (formatting, semicolons, etc.)        |
| `refactor` | Code refactoring without feature/fix             |
| `perf`     | Performance improvements                         |
| `test`     | Adding or updating tests                         |
| `ci`       | CI/CD configuration changes                      |
| `chore`    | Maintenance tasks                                |

### Examples

```
feat(ui): add fog-of-war toggle
fix(ai): prevent units from moving off-grid
docs(readme): add PWA installation instructions
chore(ci): add commit linting
```

The CI pipeline includes commit linting to enforce this format. See [commitlint.config.cjs](commitlint.config.cjs).

## Pull Requests

- Keep PRs focused and small
- Update or add tests when changing behavior
- Describe the changes clearly in the PR description
- Ensure all CI checks pass before requesting review

## Versioning & Releases

This project uses [release-please](https://github.com/googleapis/release-please) for automated versioning:

- Commits to `main` trigger release-please to create/update a release PR
- Merging the release PR creates a new GitHub release
- Version is determined automatically from commit messages:
  - `feat:` → minor version bump (1.x.0)
  - `fix:` → patch version bump (1.0.x)
  - `feat!:` or `BREAKING CHANGE:` → major version bump (x.0.0)

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Project Documentation

- [README.md](README.md) - Project overview and quick start
- [CHANGELOG.md](CHANGELOG.md) - Version history and release notes
- [CLAUDE.md](CLAUDE.md) - AI assistant guide for development
- [AGENTS.md](AGENTS.md) - Guide for AI coding agents
