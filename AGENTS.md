# AGENTS.md - AI Coding Agent Guide for Shadow Squad

This file provides essential context for AI coding agents (Cursor, Copilot, Claude, etc.) working on this project.

## Project Overview

**Shadow Squad** is a browser-based tactical turn-based strategy game with:
- Vanilla JavaScript (ES6 modules), HTML5 Canvas, CSS3
- Zero external runtime dependencies (development deps only)
- Hexagonal grid-based gameplay with fog of war
- Single-player (vs AI) and local multiplayer modes

## Quick Reference

### Key Files
| File | Purpose |
|------|---------|
| `index.html` | Main entry point with all UI screens |
| `js/main.js` | Entry point, game initialization |
| `js/config.js` | Game constants, unit classes, terrain |
| `js/state.js` | Central game state management |
| `js/renderer.js` | Canvas rendering |
| `js/combat.js` | Attack calculations, special abilities |

### Commands
```bash
npm run lint          # ESLint check
npm test              # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run build         # Generate static assets
npm run validate      # Full validation (lint + test + e2e)
```

### Hex Coordinate System
Uses axial coordinates (q, r). Key utilities in `js/hexMath.js`:
- `hexToPixel(q, r, size)` - Hex to screen position
- `pixelToHex(x, y, size)` - Screen to hex position
- `hexDistance(a, b)` - Distance between hexes
- `getNeighbors(q, r)` - Adjacent hex coordinates

## Critical Rules

1. **No build system** - Vanilla JS project. No bundler needed.
2. **German UI** - All user-facing strings are in German.
3. **State mutations** - Use helper functions in `state.js`, not direct assignment.
4. **Mobile-first** - Test changes on both desktop and mobile.
5. **No external deps** - Keep it dependency-free (except dev dependencies).
6. **Conventional Commits** - Required format: `type(scope): description`

## Workflow Pipeline

```
Push to main → CI (lint/test) → Release Please → Deploy to Pages
```

### Release Process (Automated)
- **release-please** manages versioning via Conventional Commits
- Version stored in `package.json` (updated automatically)
- GitHub Pages deployment includes:
  - Static asset generation (Playwright)
  - Version injection into `index.html`
  - Cache-busting with commit hash

## Adding Features

### New Unit Class
1. Add to `UNIT_CLASSES` in `config.js`
2. Add special ability in `combat.js` → `useSpecialAbility()`
3. Add AI logic in `ai.js` → `shouldUseSpecial()`
4. Add sprite in `assets.js` → `drawHumanSprite()`

### New Terrain
1. Add to `TERRAIN` in `config.js`
2. Add visuals in `renderer.js` → `drawTerrainDetails()`
3. Update `map.js` if procedural generation needed

## Documentation Links

- [README.md](README.md) - Project overview
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [CLAUDE.md](CLAUDE.md) - Detailed AI assistant guide
