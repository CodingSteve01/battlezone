# CLAUDE.md - AI Assistant Guide for Shadow Squad

## Project Overview

**Shadow Squad** is a browser-based tactical turn-based strategy game built with vanilla JavaScript, HTML5 Canvas, and CSS. It features hexagonal grid-based gameplay, multiple unit classes with unique abilities, fog of war, and both single-player (vs AI) and local multiplayer modes.

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Rendering**: HTML5 Canvas 2D API
- **Build System**: None (static files, no bundler required)
- **Dependencies**: None (zero external dependencies)

## Project Structure

```
battlezone/
├── index.html          # Main entry point, contains all UI screens
├── css/
│   └── styles.css      # Complete styling with CSS variables & animations
├── js/
│   ├── main.js         # Entry point, game initialization, team selection
│   ├── config.js       # Game constants, unit classes, terrain definitions
│   ├── state.js        # Central game state management
│   ├── map.js          # Procedural hex map generation
│   ├── hexMath.js      # Hex coordinate math utilities
│   ├── renderer.js     # Canvas rendering, terrain details, unit sprites
│   ├── input.js        # Mouse/touch input handling, camera pan/zoom
│   ├── units.js        # Unit creation, movement, animation
│   ├── combat.js       # Attack calculations, special abilities
│   ├── turns.js        # Turn management, round progression
│   ├── pathfinding.js  # A* pathfinding for hex grids
│   ├── fogOfWar.js     # Visibility and exploration system
│   ├── ai.js           # AI opponent logic for single-player
│   ├── ui.js           # UI updates, toasts, screen management
│   ├── powerups.js     # Power-up spawning and effects
│   ├── progression.js  # XP, leveling, rank system
│   ├── events.js       # Random round events (storms, etc.)
│   ├── assets.js       # Runtime sprite/texture generation (fallback)
│   └── assetLoader.js  # Static asset loading with fallback support
├── assets/             # Pre-generated static PNG assets (optional)
│   ├── terrain/        # Terrain textures (grass.png, forest.png, etc.)
│   ├── units/          # Unit sprites (scout_p0.png, assault_p1_selected.png, etc.)
│   └── details/        # Terrain details (tree_0_0.png, bush_0.png, rock_0.png, etc.)
├── tools/
│   └── asset-generator.html  # Browser-based asset generator tool
└── scripts/
    └── generate-assets.js    # Playwright-based asset generation (requires browser)
```

## Key Architecture Patterns

### Module System
All JavaScript files use ES6 modules with explicit imports/exports. The main entry point is `js/main.js`, loaded with `type="module"` in `index.html`.

### Centralized State
Game state is managed in `js/state.js` via a single `state` object:
```javascript
export const state = {
    screen: 'menu',
    settings: { players: 2, size: 'medium', singlePlayer: false },
    hexes: [],           // All hex tiles
    hexMap: new Map(),   // Fast lookup by "q,r" key
    units: [],           // All game units
    currentPlayer: 0,
    selectedUnit: null,
    selectedAction: 'move',
    round: 1,
    gameOver: false,
    // ... fog of war, camera, animation state
};
```

### Hex Coordinate System
Uses axial coordinates (q, r) for hex positions. Key utilities in `hexMath.js`:
- `hexToPixel(q, r, size)` - Convert hex coords to screen position
- `pixelToHex(x, y, size)` - Convert screen position to hex coords
- `hexDistance(a, b)` - Calculate distance between hexes
- `getNeighbors(q, r)` - Get adjacent hex coordinates

### Rendering Pipeline
Rendering is handled in `renderer.js`:
1. Clear canvas with gradient background
2. Draw all hexes with terrain textures and details
3. Draw movement range highlights (if in move mode)
4. Draw path preview with cost indicators
5. Draw attack lines (if targeting)
6. Draw ghost indicators (cloaked unit attack positions)
7. Draw units sorted by Y position (layering)
8. Draw attack range indicator (if in attack mode)
9. Draw UI overlays (scroll hints, event indicators)

## Game Systems

### Unit Classes (defined in `config.js`)
| Class   | HP  | Damage | Range | Move | Special Ability |
|---------|-----|--------|-------|------|-----------------|
| Scout   | 60  | 18     | 4     | 5    | Sprint (+3 move) |
| Assault | 100 | 35     | 2     | 3    | Powershot (+20 dmg) |
| Medic   | 80  | 12     | 2     | 4    | Heal (team +30 HP) |
| Sniper  | 50  | 45     | 6     | 2    | Cloak (invisible) |
| Ninja   | 65  | 40     | 1     | 4    | Stealth + bonus move |

### Terrain Types (defined in `config.js`)
| Type   | Walkable | Cover | Move Cost | Special |
|--------|----------|-------|-----------|---------|
| Grass  | Yes      | No    | 1         | - |
| Forest | Yes      | Yes   | 2         | -25% hit chance |
| Hills  | Yes      | No    | 2         | +1 range, +10% defense |
| Rock   | No       | -     | ∞         | Impassable |
| Water  | No       | -     | ∞         | Impassable |
| Sand   | Yes      | No    | 1         | - |
| Swamp  | Yes      | No    | 3         | Slow movement |

### Combat System (`combat.js`)
- Base hit chance: 70%
- Cover (forest): -25% hit chance
- Hills (attacker): +15% accuracy
- Hills (defender): -10% hit chance
- Distance penalty: -5% per hex (except snipers)
- Sniper accuracy bonus: +20% base, +10% at 4+ range
- Critical hits possible based on level/upgrades

### Fog of War (`fogOfWar.js`)
- Each player has their own explored hexes (stored per-player)
- Vision range per unit (scout: 6, sniper: 7, others: 4-5)
- Three states: visible, explored (dimmed), hidden (black)
- Stealth units can hide from enemy vision

### AI System (`ai.js`)
Priority-based decision making:
1. Attack enemies in range
2. Use special abilities when beneficial
3. Move toward enemies or explore
4. Attack again after moving

### Action Points (AP)
- Each unit gets 4 AP per turn
- Movement: 1+ AP (based on terrain move cost)
- Attack: 1 AP
- Special ability: 2 AP

## Development Guidelines

### Running the Game
Simply open `index.html` in a browser. No build step required.
```bash
# Using Python's built-in server
python -m http.server 8000

# Or Node.js http-server
npx http-server
```

### Code Style Conventions
- Use ES6+ features (arrow functions, destructuring, template literals)
- Each module has a clear responsibility (single-purpose files)
- Function names are descriptive: `calculateHitChance`, `getReachableHexes`
- State mutations happen through dedicated functions, not direct assignment
- UI text is in German (game was developed for German audience)

### Adding New Features

**Adding a new unit class:**
1. Add definition to `UNIT_CLASSES` in `config.js`
2. Add special ability handler in `combat.js` → `useSpecialAbility()`
3. Add AI decision logic in `ai.js` → `shouldUseSpecial()`
4. Add sprite drawing in `assets.js` → `drawHumanSprite()`

**Adding new terrain:**
1. Add terrain definition to `TERRAIN` in `config.js`
2. Add visual details in `renderer.js` → `drawTerrainDetails()`
3. Update map generation in `map.js` if needed

**Adding new power-ups:**
1. Add type to `POWERUP_TYPES` in `powerups.js`
2. Add effect handler in `applyPowerup()`
3. Update buff system if temporary effect

### Mobile Considerations
- Touch input fully supported with drag-to-pan
- Tap-to-confirm movement system (first tap shows path, second confirms)
- Double-tap to center on current unit
- Safe area insets for notched devices
- Responsive hex sizing based on viewport

### Performance Notes
- Terrain details use seeded random for consistent decoration
- Only visible hexes are rendered (off-screen culling)
- Movement animations use `requestAnimationFrame`
- Canvas uses device pixel ratio for crisp rendering

### Static Asset System

The game supports both **runtime-generated** and **pre-generated static** assets:

**Architecture:**
- `assetLoader.js` - Unified asset loading with automatic fallback
- `assets.js` - Runtime canvas-based generation (fallback)
- `tools/asset-generator.html` - Browser-based static asset generator
- `scripts/generate-assets.js` - Automated Playwright-based generation

**How it works:**
1. On load, `assetLoader.js` checks if static assets exist in `assets/`
2. If found, loads PNG files for textures, sprites, and details
3. If not found, falls back to runtime canvas generation
4. Both methods are transparent to the renderer

**CI/CD Asset Generation:**
Assets are automatically generated during GitHub Pages deployment:
1. The `static.yml` workflow runs `npm run build` (which calls `generate-assets.js`)
2. Playwright launches a headless browser to render all assets
3. Assets are saved to `assets/` and included in the deployment
4. The repository only contains `.gitkeep` files (assets are generated at deploy time)

**Generating Assets Locally:**
Option 1 - Automated (requires Playwright):
```bash
npm ci
npx playwright install chromium
npm run build
```

Option 2 - Manual (browser-based):
1. Open `tools/asset-generator.html` in a browser
2. Click "Generate All Assets" to create previews
3. Right-click to save individual assets, or use browser dev tools
4. Save files to the `assets/` directory structure

**Asset Types:**
- **Terrain textures** (128x128): `assets/terrain/grass.png`, `forest.png`, etc.
- **Unit sprites** (130x130): `assets/units/scout_p0.png`, `assault_p1_selected.png`, etc.
- **Terrain details** (128x128): `assets/details/tree_0_0.png`, `bush_0.png`, `rock_0.png`, etc.

**Benefits of Static Assets:**
- Faster initial load (no runtime generation)
- Ability to create more detailed/hand-crafted graphics
- Reduced CPU usage during gameplay
- Consistent visuals across devices

## Common Tasks

### Debug State
```javascript
// In browser console
import('./js/state.js').then(m => console.log(m.state));
```

### Force End Game
```javascript
import('./js/turns.js').then(m => m.endGame(0)); // Player 1 wins
```

### Skip to Game (bypassing menus)
Modify `init()` in `main.js` to call `startGame()` directly.

## File Dependencies

```
main.js
├── state.js
├── config.js
├── map.js → hexMath.js, state.js, config.js
├── units.js → config.js, state.js, map.js
├── turns.js → state.js, config.js, units.js, fogOfWar.js, combat.js, ui.js
├── renderer.js → config.js, state.js, hexMath.js, pathfinding.js, units.js, fogOfWar.js, assets.js
├── input.js → state.js, hexMath.js, pathfinding.js, units.js, combat.js, turns.js, ui.js, renderer.js
├── combat.js → state.js, config.js, hexMath.js, units.js, ui.js, progression.js
├── fogOfWar.js → state.js, hexMath.js, config.js
├── ai.js → state.js, hexMath.js, pathfinding.js, units.js, combat.js, fogOfWar.js, ui.js, renderer.js
├── ui.js → state.js, config.js, combat.js
├── pathfinding.js → state.js, config.js, hexMath.js
├── powerups.js → state.js, config.js
├── progression.js → config.js
└── events.js → state.js
```

## CI/CD Pipeline

### Workflow Overview

The project uses four GitHub Actions workflows that work together:

```
Push to main
    │
    ├─→ ci.yml (on PR) ─→ Lint + Test + Commit Lint
    │
    ├─→ release.yml ─→ Release Please (creates release PR)
    │                         │
    │                         └─→ On merge: Publish release archive
    │
    └─→ static.yml ─→ Generate assets + Deploy to Pages
                            │
                            └─→ Triggered by: push, release, workflow_run
```

### Workflow Files

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Pull requests | Commit lint, ESLint, unit tests |
| `release.yml` | Push to main | Release-please automation, publish ZIP |
| `static.yml` | Push, release, manual | Asset generation, Pages deployment |
| `preview.yml` | Manual dispatch | Preview deployments from branches |

### Release Please (Semantic Versioning)

This project uses [release-please](https://github.com/googleapis/release-please) for automated versioning:

**Configuration files:**
- `release-please-config.json` - Release settings and changelog sections
- `.release-please-manifest.json` - Current version tracking

**How it works:**
1. Every push to `main` triggers release-please
2. It analyzes commits and creates/updates a release PR
3. Merging the PR creates a GitHub release with:
   - Updated `package.json` version
   - Updated `CHANGELOG.md`
   - Git tag (e.g., `shadow-squad-v1.10.0`)
   - ZIP archive of the project

**Version bumps from commits:**
- `feat:` → Minor bump (1.x.0)
- `fix:` → Patch bump (1.0.x)
- `feat!:` or `BREAKING CHANGE:` → Major bump (x.0.0)

## GitHub Pages Deployment

### Automatic Deployment Pipeline (GitHub Actions)

The project uses a GitHub Actions pipeline (`.github/workflows/static.yml`) that:

1. Triggers on push to `main`, release publish, or workflow completion
2. **Generates all static assets** using Playwright (terrain, units, details)
3. Replaces version strings with semantic version from `package.json` (managed by release-please)
4. Cache-busts file references with git commit hash (e.g., `?v=fa38f5d`)
5. Deploys all static files to GitHub Pages

**Version Display:**
- The in-game version info (bottom of menu) shows: `v1.6.0 • 23.12.2025 14:30`
- Version comes from `package.json` (updated automatically by release-please)
- Build date is set at deployment time (Europe/Berlin timezone)

**No manual version updates needed!** Just push to `main` and wait ~1-2 minutes.

### Testing After Deployment

After pushing, wait 1-2 minutes for the pipeline to complete, then:

1. **Hard refresh**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Check DevTools Network tab**: Verify files load fresh (status `200`)
3. **Use Incognito/Private browsing**: Bypasses all caching
4. **Check version info**: Should show current version and recent build date

### GitHub Pages Setup (One-Time)

1. Go to Repository → Settings → Pages
2. Under "Build and deployment", select **GitHub Actions**
3. The workflow will auto-deploy on push to main

## Important Notes for AI Assistants

1. **No build system** - This is a vanilla JS project. Don't suggest npm/webpack configurations.

2. **German UI text** - All user-facing strings are in German. Maintain consistency when adding new text.

3. **State mutations** - Always use the helper functions in `state.js` rather than modifying state directly.

4. **Coordinate system** - Hex coordinates use axial (q, r) format, not offset coordinates.

5. **Mobile-first** - The game is designed for mobile/touch. Test any changes on both desktop and mobile.

6. **Canvas rendering** - All game visuals are drawn on canvas. The DOM is only for UI overlays.

7. **Module imports** - All files use ES6 modules. Circular dependencies should be avoided.

8. **No external dependencies** - Keep it that way. Don't suggest adding libraries.

9. **Conventional Commits** - All commits must follow the format `type(scope): description`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Related Documentation

- [README.md](README.md) - Project overview and quick start
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines and commit conventions
- [CHANGELOG.md](CHANGELOG.md) - Version history and release notes
- [AGENTS.md](AGENTS.md) - Quick reference for AI coding agents
