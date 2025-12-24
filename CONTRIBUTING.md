# Contributing to Shadow Squad

Thanks for taking the time to contribute! This guide explains how to work on the project and what we expect in pull requests.

## Getting Started

1. Fork the repository and create a feature branch.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests and linting before opening a PR:
   ```bash
   npm run lint
   npm test
   ```

## Commit Message Convention

We use Conventional Commits. Every commit must follow the format:

```
type(scope): short description
```

Examples:

```
feat(ui): add fog-of-war toggle
fix(ai): prevent units from moving off-grid
chore(ci): add commit linting
```

The CI pipeline includes commit linting to enforce this format.

## Pull Requests

- Keep PRs focused and small.
- Update or add tests when changing behavior.
- Describe the changes clearly in the PR description.
