# Shadow Squad

[![CI](https://github.com/CodingSteve01/battlezone/actions/workflows/ci.yml/badge.svg)](https://github.com/CodingSteve01/battlezone/actions/workflows/ci.yml)
[![Deploy to Pages](https://github.com/CodingSteve01/battlezone/actions/workflows/static.yml/badge.svg)](https://github.com/CodingSteve01/battlezone/actions/workflows/static.yml)
[![Release](https://github.com/CodingSteve01/battlezone/actions/workflows/release.yml/badge.svg)](https://github.com/CodingSteve01/battlezone/actions/workflows/release.yml)
[![Version](https://img.shields.io/github/v/release/CodingSteve01/battlezone?label=version)](https://github.com/CodingSteve01/battlezone/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A tactical turn-based strategy game built with JavaScript and HTML5 Canvas. Command your squad of specialized units in hex-grid combat with fog of war, power-ups, and AI opponents.

## 🎮 Play Now

**[▶️ Play Shadow Squad Online](https://codingsteve01.github.io/battlezone/)**

Or run locally with `npm install && npm run dev` (see [Development](#development) section).

## 📲 Install Offline (PWA)

Shadow Squad can be installed as a Progressive Web App and runs offline:

1. **[Open the game](https://codingsteve01.github.io/battlezone/)** in Chrome, Edge, or Safari
2. Select **Install** from the browser menu (or "Add to Home Screen" on iOS)
3. Launch the game as a standalone app - it works offline too!

> **Tip**: After an update, open the page online once to load the latest assets.

## Features

- **Hex-grid tactical combat** - Strategic positioning on procedurally generated maps
- **5 unique unit classes** - Scout, Assault, Medic, Sniper, and Ninja with special abilities
- **Fog of War** - Limited visibility based on unit positions
- **Single-player vs AI** - Challenge an intelligent AI opponent
- **Local multiplayer** - 2-4 players on the same device (hot-seat)
- **Mobile-optimized** - Full touch support with intuitive controls
- **Power-ups & Progression** - Collect items and level up your units

## Unit Classes

| Class | Role | Special Ability |
|-------|------|-----------------|
| Scout | Fast recon | Sprint - Extra movement |
| Assault | Heavy damage | Powershot - Bonus damage |
| Medic | Team support | Heal - Restore team HP |
| Sniper | Long range | Cloak - Turn invisible |
| Ninja | Stealth melee | Stealth + bonus movement |

## Controls

### Desktop
- **Click & Drag** - Pan the map
- **Click hex** - Select movement target (click again to confirm)
- **Click enemy** - Target for attack (click again to attack)
- **Mouse wheel** - Scroll map

### Mobile
- **Drag** - Pan the map
- **Tap hex** - Select target (tap again to confirm)
- **Double-tap** - Center on current unit

## How to Play

1. Select game mode (Single-player or Multiplayer)
2. Choose number of players and map size
3. Each player selects 3 units for their team
4. On your turn, use 4 Action Points (AP) to:
   - Move (1+ AP based on terrain)
   - Attack enemies (1 AP)
   - Use special ability (2 AP)
5. Eliminate all enemy units to win!

## Development

### Running Locally

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

### Project Structure

```
├── index.html      # Main HTML with all UI screens
├── css/styles.css  # Styling and animations
└── js/
    ├── main.js     # Entry point & initialization
    ├── config.js   # Game constants & definitions
    ├── state.js    # Central state management
    ├── map.js      # Procedural map generation
    ├── renderer.js # Canvas rendering
    ├── combat.js   # Combat & abilities
    ├── ai.js       # AI opponent logic
    └── ...         # Additional modules
```

### Tech Stack

- JavaScript (ES6 modules) with Vite build system
- HTML5 Canvas 2D (with optional PixiJS WebGL renderer)
- CSS3 with custom properties
- Runtime dependencies: [PixiJS](https://pixijs.com/) for advanced graphics

## GitHub Pages Deployment

This project is designed to be deployed on GitHub Pages. To ensure updates are properly loaded:

### Cache-Busting Tips

1. **Hard refresh**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Clear site data**: DevTools → Application → Clear Storage
3. **Incognito mode**: Test in a private window to bypass cache

### For Developers

If you're making changes and want to ensure fresh loads:

1. Add version query strings to script tags:
   ```html
   <script type="module" src="js/main.js?v=1.2"></script>
   ```

2. Or add cache-control headers via `_headers` file (Netlify) or server config

3. For CSS changes, same technique:
   ```html
   <link rel="stylesheet" href="css/styles.css?v=1.2">
   ```

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Mobile Safari / Chrome for Android

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:
- Commit message conventions (Conventional Commits)
- Pull request process
- Development setup

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [CHANGELOG.md](CHANGELOG.md) - Version history and release notes
- [CLAUDE.md](CLAUDE.md) - AI assistant guide for development

## License

MIT License - Feel free to modify and share!

---

*Built with JavaScript, PixiJS, and Vite.*
