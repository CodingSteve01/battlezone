# WebGL Mesh-Based Renderer

## Overview

Shadow Squad now includes an **experimental WebGL mesh-based renderer** as an alternative to the traditional Canvas 2D renderer. This new renderer provides:

- **Mesh-based hex tile rendering** - Hexes are rendered as 3D meshes with proper depth
- **Rectangular texture mapping** - Uses UV coordinates for efficient texture sampling
- **Height-based shading** - GLSL shaders provide realistic lighting based on tile height
- **Fog of war support** - Seamlessly integrates with the existing fog of war system
- **Automatic fallback** - Falls back to Canvas 2D if WebGL is not available

## Configuration

The renderer can be configured in `js/config.js`:

```javascript
RENDERER: {
    TYPE: 'canvas2d',        // 'canvas2d' or 'webgl'
    PREFER_WEBGL: false,     // Auto-switch to WebGL if available
    ALLOW_FALLBACK: true     // Fallback to Canvas 2D if WebGL fails
}
```

## Status

### ✅ Implemented
- Basic hex mesh geometry generation
- Texture atlas system for rectangular textures
- Vertex and fragment shaders with height-based lighting
- Fog of war integration (hidden/explored/visible states)
- Automatic WebGL detection and Canvas 2D fallback

### ⚠️ Pending
- Unit rendering in WebGL
- Foreground elements (trees, rocks, bushes)
- Animated textures (water, grass, wheat)
- Cliff face rendering
- Performance optimization

## Key Files

- `js/rendererWebGL.js` - WebGL renderer implementation
- `js/textureAtlas.js` - Texture atlas generator
- `tests/e2e/webgl-renderer.spec.js` - E2E tests

## Enabling WebGL

To enable the WebGL renderer, set `RENDERER.TYPE` to `'webgl'` in `js/config.js`.

Note: The WebGL renderer is experimental and not all features are implemented yet. The game will automatically fall back to Canvas 2D if WebGL initialization fails.
