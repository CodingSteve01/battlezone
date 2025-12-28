# CLAUDE.md - AI Assistant Guide for Shadow Squad

## Project Overview

**Shadow Squad** is a browser-based tactical turn-based strategy game built with JavaScript, HTML5 Canvas, and CSS. It features hexagonal grid-based gameplay, multiple unit classes with unique abilities, fog of war, and both single-player (vs AI) and local multiplayer modes.

## Technology Stack

- **Frontend**: JavaScript (ES6 modules), HTML5, CSS3
- **Rendering**: HTML5 Canvas 2D API with animated terrain effects
- **Build System**: Vite (for development server and production builds)
- **Dependencies**: None (zero runtime dependencies)

## Project Structure

```
battlezone/
├── index.html          # Main entry point, contains all UI screens
├── css/
│   └── styles.css      # Complete styling with CSS variables & animations
├── js/
│   ├── main.js            # Entry point, game initialization, team selection
│   ├── config.js          # Game constants, unit classes, terrain definitions
│   ├── state.js           # Central game state management
│   ├── map.js             # Procedural hex map generation
│   ├── hexMath.js         # Hex coordinate math utilities
│   ├── renderer.js        # Canvas rendering, terrain details, unit sprites
│   ├── input.js           # Mouse/touch input handling, camera pan/zoom
│   ├── units.js           # Unit creation, movement, animation
│   ├── combat.js          # Attack calculations, special abilities
│   ├── turns.js           # Turn management, round progression
│   ├── pathfinding.js     # A* pathfinding for hex grids
│   ├── fogOfWar.js        # Visibility and exploration system
│   ├── ai.js              # AI opponent logic for single-player
│   ├── ui.js              # UI updates, toasts, screen management
│   ├── powerups.js        # Power-up spawning and effects
│   ├── progression.js     # XP, leveling, rank system
│   ├── events.js          # Random round events (storms, etc.)
│   ├── assets.js          # Runtime sprite/texture generation (fallback)
│   ├── assetLoader.js     # Unified asset loading with anchor point support
│   └── spriteSheetLoader.js # Sprite sheet parsing and extraction
├── assets/
│   └── spritesheets/   # Generated sprite sheet files
│       ├── terrain-hexes.png/.json    # Terrain tiles (grass, forest, streams, paths, etc.)
│       ├── trees.png/.json            # Tree sprites with variants
│       ├── environment-details.png/.json  # Bushes, grass, rocks
│       └── unit-sprites.png/.json     # All unit classes and states
├── tools/
│   └── asset-generator/  # Browser-based asset generator (Express server)
│       ├── server.js     # Express server for serving generator
│       ├── public/
│       │   ├── index.html    # Generator UI
│       │   ├── app.js        # Main generator logic, sprite sheet creation
│       │   └── generators/   # Individual asset generators
│       │       ├── terrain.js    # Hex terrain textures (including streams, paths)
│       │       ├── trees.js      # Tree sprites with branch networks
│       │       ├── bushes.js     # Bush/vegetation sprites
│       │       ├── characters.js # Unit character sprites
│       │       ├── noise.js      # Perlin noise for procedural textures
│       │       └── color.js      # Color utility functions
│       └── package.json
└── scripts/
    └── generate-assets.js    # Playwright-based headless asset generation
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

**Directional Terrain Tiles** (for streams and paths):

The asset generator supports directional tiles that connect specific hex edges:
- **Straight connections**: `_ew` (East-West), `_nesw` (NE-SW), `_nwse` (NW-SE)
- **Curved connections**: `_e_ne`, `_ne_nw`, `_nw_w`, `_w_sw`, `_sw_se`, `_se_e`

Stream tiles (`stream_ew`, `stream_nesw`, etc.) show flowing water with banks.
Path tiles (`path_ew`, `path_nesw`, etc.) show worn dirt tracks with grass edges.

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
Use the Vite development server for the best experience:
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
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

### Sprite Sheet System

The game uses a **sprite sheet system** for efficient asset loading:

**Architecture:**
- `spriteSheetLoader.js` - Loads sprite sheets and extracts individual sprites
- `assetLoader.js` - Unified API with anchor point support for positioning
- `assets.js` - Runtime canvas-based generation (fallback)
- `tools/asset-generator/` - Browser-based sprite sheet generator
- `scripts/generate-assets.js` - Automated Playwright-based generation

**How it works:**
1. On load, `spriteSheetLoader.js` loads sprite sheet PNGs and JSON metadata
2. Individual sprites are extracted from the sheet based on JSON coordinates
3. If sprite sheets are unavailable, falls back to runtime canvas generation
4. The renderer uses `assetLoader.js` API transparently

**Sprite Sheet Format (V2.0):**

Sprite sheets use a JSON metadata format with anchor points:
```json
{
  "version": "2.0",
  "sprites": {
    "tree_oak_0": {
      "x": 0, "y": 0,
      "width": 256, "height": 256,
      "contentBounds": { "x": 20, "y": 10, "width": 200, "height": 230 },
      "anchor": { "x": 0.5, "y": 0.95 }
    }
  }
}
```

- `contentBounds` - Actual content area within the sprite cell (for cropped assets)
- `anchor` - Normalized (0-1) positioning point (e.g., 0.5, 1.0 = center-bottom)

**Anchor Points:**

Anchor points enable correct sprite positioning:
```javascript
// Get anchor for a detail sprite
const anchor = getDetailAnchor('tree', 0); // { x: 0.5, y: 0.95 }

// Draw sprite with anchor-based positioning
drawDetailSprite(ctx, 'tree', 0, tileX, tileY, scale);
```

Trees and details use center-bottom anchors so they're planted at the correct ground position regardless of sprite dimensions.

**CI/CD Asset Generation:**
Assets are automatically generated during GitHub Pages deployment:
1. The `static.yml` workflow runs `npm run build` (which calls `generate-assets.js`)
2. Playwright launches a headless browser to render all assets
3. Assets are saved to `assets/spritesheets/` and included in the deployment

**Generating Assets Locally:**
Option 1 - Automated (requires Playwright):
```bash
npm ci
npx playwright install chromium
npm run generate-assets
```

Option 2 - Manual (browser-based):
```bash
cd tools/asset-generator && npm ci && npm start
# Open http://localhost:3000 in browser
# Click "Generate All" then "Save All to Assets"
```

**Sprite Sheet Files:**
- `terrain-hexes.png/.json` - All terrain tiles (grass, forest, streams, paths, etc.)
- `trees.png/.json` - Tree variants with cropped content and anchors
- `environment-details.png/.json` - Bushes, grass, rocks with anchors
- `unit-sprites.png/.json` - All unit classes, players, and states

**Benefits:**
- Fewer HTTP requests (one sheet vs. many individual files)
- Efficient GPU texture batching
- Whitespace-cropped sprites with anchor-based positioning
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
├── renderer.js → config.js, state.js, hexMath.js, pathfinding.js, units.js, fogOfWar.js, assetLoader.js
├── input.js → state.js, hexMath.js, pathfinding.js, units.js, combat.js, turns.js, ui.js, renderer.js
├── combat.js → state.js, config.js, hexMath.js, units.js, ui.js, progression.js
├── fogOfWar.js → state.js, hexMath.js, config.js
├── ai.js → state.js, hexMath.js, pathfinding.js, units.js, combat.js, fogOfWar.js, ui.js, renderer.js
├── ui.js → state.js, config.js, combat.js
├── pathfinding.js → state.js, config.js, hexMath.js
├── powerups.js → state.js, config.js
├── progression.js → config.js
├── events.js → state.js
├── assetLoader.js → config.js, spriteSheetLoader.js
└── spriteSheetLoader.js (standalone)
```

## CI/CD Pipeline

### Workflow Overview

The project uses five GitHub Actions workflows that work together:

```
Push to main
    │
    ├─→ ci.yml (on PR) ─→ Lint + Test + Commit Lint
    │
    ├─→ release.yml ─→ Release Please (creates/updates release PR)
    │                         │
    │                         └─→ On PR merge: Publish release + ZIP archive
    │
    └─→ static.yml ─→ Generate assets + Deploy to Pages
                            │
                            └─→ Also triggered by: release published

Manual trigger (workflow_dispatch)
    │
    └─→ generate-assets.yml ─→ Generate sprite sheets + Create PR
```

### Workflow Files

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Pull requests | Commit lint, ESLint, unit tests |
| `release.yml` | Push to main | Release-please automation, publish ZIP |
| `static.yml` | Push, release, manual | Asset generation, Pages deployment |
| `preview.yml` | Manual dispatch | Preview deployments from branches |
| `generate-assets.yml` | Manual dispatch | Generate assets and create PR |

**Manual Asset Generation Workflow:**

The `generate-assets.yml` workflow allows on-demand asset regeneration:
1. Go to Actions → "Generate Assets" → "Run workflow"
2. Optionally specify a custom branch name
3. The workflow generates all sprite sheets via Playwright
4. Creates a PR with the updated assets for review

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

1. Triggers on push to `main` or release publish
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

1. **Vite build system** - Use `npm run dev` for development. The project uses Vite for bundling.

2. **German UI text** - All user-facing strings are in German. Maintain consistency when adding new text.

3. **State mutations** - Always use the helper functions in `state.js` rather than modifying state directly.

4. **Coordinate system** - Hex coordinates use axial (q, r) format, not offset coordinates.

5. **Mobile-first** - The game is designed for mobile/touch. Test any changes on both desktop and mobile.

6. **Canvas rendering** - All game visuals are drawn on canvas. The DOM is only for UI overlays.

7. **Module imports** - All files use ES6 modules. Circular dependencies should be avoided.

8. **Minimal dependencies** - Only add dependencies when truly necessary. Keep runtime dependencies at zero.

9. **Conventional Commits** - All commits must follow the format `type(scope): description`. See [CONTRIBUTING.md](CONTRIBUTING.md).

   **Allowed commit types:**
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

   **Examples:**
   ```
   feat(ui): add fog-of-war toggle
   fix(ai): prevent units from moving off-grid
   test(fogOfWar): add visibility unit tests
   chore(deps): update vite to v6.0.0
   ```

   **Important:** Do NOT use types like `debug:` or custom types - CI will reject them!

## Related Documentation

- [README.md](README.md) - Project overview and quick start
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines and commit conventions
- [CHANGELOG.md](CHANGELOG.md) - Version history and release notes
- [AGENTS.md](AGENTS.md) - Quick reference for AI coding agents
