# Shadow Squad Asset Generator

Browser-based procedural asset generator for the Shadow Squad tactical game. Creates high-quality terrain textures, vegetation sprites, and character sprites using advanced algorithms like L-Systems for trees and Simplex noise for terrain.

## Features

- **L-System Trees**: Generate realistic procedural trees (oak, pine, birch, willow, maple, dead)
- **Seamless Terrain**: Tileable hex terrain textures (grass, forest, hills, rock, water, sand, swamp, river)
- **Vegetation**: Procedural bushes, grass clumps, ferns, and flowers
- **Characters**: Tactical soldier sprites with classes, poses, equipment, and player colors
- **Sprite Sheets**: Automatic sprite sheet generation with JSON metadata

## Quick Start

```bash
# Install and run
npx shadow-squad-assets

# Or clone and run locally
git clone <repo-url>
cd shadow-squad-assets
npm install
npm start
```

This opens a browser-based UI where you can:
1. Configure generation options (variants, sizes)
2. Generate individual asset types or all at once
3. Preview generated assets
4. Download sprite sheets as PNG + JSON

## CLI Options

```bash
npx shadow-squad-assets --help

Options:
  -V, --version      output the version number
  -p, --port <port>  Port to run the server on (default: "3000")
  --no-open          Do not automatically open browser
  -h, --help         display help for command
```

## Asset Types

### Terrain (8 types × 4 variants = 32 textures)

| Type    | Description                           |
|---------|---------------------------------------|
| grass   | Standard grass with blade details     |
| forest  | Dark forest floor with leaf litter    |
| hills   | Rolling hills with contour lines      |
| rock    | Rocky terrain with cracks and moss    |
| water   | Water with wave effects               |
| sand    | Desert sand with ripples              |
| swamp   | Murky swamp with water patches        |
| river   | Flowing river with current lines      |

### Trees (6 types × 4 variants = 24 sprites)

| Type   | Description                    |
|--------|--------------------------------|
| oak    | Broad deciduous tree           |
| pine   | Coniferous pine tree           |
| birch  | White-barked birch tree        |
| willow | Drooping willow tree           |
| maple  | Dense maple tree               |
| dead   | Bare dead tree                 |

### Bushes (5 types × 4 variants = 20 sprites)

| Type      | Description                    |
|-----------|--------------------------------|
| round     | Spherical bush                 |
| wild      | Irregular wild bush            |
| flowering | Bush with colorful flowers     |
| berry     | Bush with red berries          |
| fern      | Fern-style plant               |

### Grass (4 types × 4 variants = 16 sprites)

| Type   | Description           |
|--------|-----------------------|
| short  | Short grass clumps    |
| tall   | Tall grass stalks     |
| wheat  | Wheat-like plants     |
| reed   | Reed plants           |

### Characters (5 classes × 4 poses × 4 players = 80 sprites)

**Classes:**
- Scout (light armor, SMG, beret)
- Assault (heavy armor, rifle, tactical helmet)
- Medic (medium armor, pistol, medkit)
- Sniper (ghillie suit, sniper rifle)
- Commando (stealth gear, knife)

**Poses:**
- Normal (standing ready)
- Cover (crouching)
- Attack (aiming)
- Dead (fallen)

**Player Colors:**
- Green (Player 1)
- Red (Player 2)
- Blue (Player 3)
- Yellow (Player 4)

## Output Format

The generator creates sprite sheets with accompanying JSON metadata:

### Sprite Sheet PNG
All assets are packed into a grid-based sprite sheet.

### JSON Metadata
```json
{
  "version": "1.0",
  "dimensions": { "width": 1024, "height": 768 },
  "sprites": [
    {
      "id": "grass_v0",
      "bounds": { "x": 0, "y": 0, "width": 256, "height": 192 },
      "metadata": { "type": "grass", "variant": 0 }
    }
  ]
}
```

## Algorithms

### L-System Trees

Trees are generated using Lindenmayer systems with the following rules:

```
Oak:    F -> FF+[+F-F-F]-[-F+F+F]  (22.5° angle, 4 iterations)
Pine:   F -> FF[++F][-F][+F][-F][F]  (30° angle, 4 iterations)
Birch:  F -> F[+F]F[-F]F  (25° angle, 4 iterations)
```

### Terrain Noise

Terrain textures use Fractal Brownian Motion with Simplex noise:
- 4 octaves for natural variation
- Separate detail noise layer
- Type-specific decorations (grass blades, waves, etc.)

## Integration with Shadow Squad

Copy the downloaded sprite sheets to your game's `assets/spritesheets/` directory:

```bash
cp terrain-hexes.png terrain-hexes.json ../battlezone/assets/spritesheets/
cp trees.png trees.json ../battlezone/assets/spritesheets/
cp environment-details.png environment-details.json ../battlezone/assets/spritesheets/
cp unit-sprites.png unit-sprites.json ../battlezone/assets/spritesheets/
```

The JSON files are compatible with Shadow Squad's `spriteSheetLoader.js`.

## Requirements

- Node.js >= 18.0.0
- Modern web browser (Chrome, Firefox, Safari, Edge)

## License

MIT
