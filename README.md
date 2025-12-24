# Shadow Squad

A tactical turn-based strategy game built with vanilla JavaScript and HTML5 Canvas. Command your squad of specialized units in hex-grid combat with fog of war, power-ups, and AI opponents.

## Play Now

Open `index.html` in a modern browser or host on any static file server.

## Offline installieren (PWA)

Shadow Squad kann als Offline-App installiert werden, sobald die Seite einmal online geöffnet wurde.

1. Öffne die Spielseite in Chrome, Edge oder Safari.
2. Wähle **Installieren** im Browser-Menü (oder „Zum Startbildschirm hinzufügen“ auf iOS).
3. Starte das Spiel anschließend als eigenständige App – es läuft auch offline.

> Hinweis: Damit Offline-Assets aktuell bleiben, die Seite nach einem Update einmal online öffnen.

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
# Python
python -m http.server 8000

# Node.js
npx http-server

# Then open http://localhost:8000
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

- Vanilla JavaScript (ES6 modules)
- HTML5 Canvas 2D
- CSS3 with custom properties
- Zero external dependencies

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

## License

MIT License - Feel free to modify and share!

---

*Built with vanilla JavaScript, no frameworks, no dependencies.*
