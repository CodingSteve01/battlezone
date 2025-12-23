# Legacy Canvas 2D Version

This folder contains the original Canvas 2D implementation of Shadow Squad with all animations enabled.

## Why Legacy?

The main application has been migrated to **PixiJS/WebGL** for better performance:
- Hardware-accelerated rendering (GPU)
- Smooth animations on all devices
- Better particle systems and effects

## Running the Legacy Version

1. Open `index.html` directly in a browser, or
2. Serve with a local server:
   ```bash
   cd legacy
   python -m http.server 8001
   ```

## Features

- Canvas 2D rendering
- Animated grass, water, particles
- Full game functionality
- Works without WebGL support

## Note

This version may have performance issues on some devices due to CPU-based rendering.
The main PixiJS version is recommended for the best experience.
