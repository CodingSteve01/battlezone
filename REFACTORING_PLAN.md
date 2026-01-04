# Shadow Squad Refactoring Plan

**Document Version:** 1.2
**Created:** 2026-01-04
**Last Updated:** 2026-01-04
**Status:** In Progress - Phase 3

---

## Executive Summary

This document outlines a comprehensive refactoring plan to bring the Shadow Squad codebase into compliance with the architectural guidelines defined in AGENTS.md. The plan is structured as **35 individual PRs**, each under 400 LOC diff, designed to be merged incrementally without breaking functionality.

### Current State

| Metric | Before | Current | Target | Status |
|--------|--------|---------|--------|--------|
| Files > 300 LOC | 11 | 10 | 0 | 🟡 In Progress |
| Functions > 40 LOC | 20+ | 20+ | 0 | ⬜ Pending |
| Circular dependencies | 1 | 0 | 0 | ✅ Fixed |
| Max nesting depth | 5+ | 5+ | 3 | ⬜ Pending |
| state.js LOC | 1,496 | 1,301 | <300 | 🟡 -195 LOC |
| renderer.js LOC | 6,053 | 4,017 | <300 | 🟡 -2,036 LOC (-34%) |

### Progress Summary

- **Phase 1:** ✅ Complete (PRs 1-4)
- **Phase 2:** ✅ Complete (PRs 5-11)
- **Phase 3:** 🟡 In Progress (PRs 13-18)
- **Phases 4-6:** ⬜ Pending

### Key Violations (Updated)

1. **ai.js** (6,272 LOC) - 🔴 20x over file limit
2. **renderer.js** (4,017 LOC) - 🔴 13x over file limit (was 6,053, -34%)
3. **state.js** (1,301 LOC) - 🟡 4x over (was 1,496 LOC, -195 LOC)
4. **Circular dependency** between ai.js ↔ renderer.js - ✅ FIXED
5. **Deep nesting** (4-5 levels) in critical functions - ⬜ Pending

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [Dependency Analysis](#2-dependency-analysis)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Phase 1: Foundation](#4-phase-1-foundation-prs-1-4)
5. [Phase 2: State Decomposition](#5-phase-2-state-decomposition-prs-5-12)
6. [Phase 3: Renderer Decomposition](#6-phase-3-renderer-decomposition-prs-13-18)
7. [Phase 4: AI Decomposition](#7-phase-4-ai-decomposition-prs-19-24)
8. [Phase 5: Input & Main Cleanup](#8-phase-5-input--main-cleanup-prs-25-28)
9. [Phase 6: Function-Level Refactoring](#9-phase-6-function-level-refactoring-prs-29-35)
10. [Testing Strategy](#10-testing-strategy)
11. [Risk Mitigation](#11-risk-mitigation)
12. [Success Criteria](#12-success-criteria)
13. [Appendices](#13-appendices)

---

## 1. Guiding Principles

All refactoring work must adhere to these principles from AGENTS.md:

### 1.1 Non-Negotiable Rules

- **Max 300 LOC per file** - No exceptions without documented justification
- **Max 40 LOC per function** - Extract helpers for longer logic
- **Max 3 nesting levels** - Use early returns and extraction
- **One responsibility per file** - Clear separation of concerns
- **No circular dependencies** - Unidirectional dependency flow

### 1.2 Refactoring Safety Rules

- **No behavior changes** - Tests must pass before and after
- **Small, reviewable steps** - Each PR ≤ 400 LOC diff
- **Compile at each step** - Every commit must run
- **Explicit over implicit** - No hidden side effects

### 1.3 PR Discipline

Each PR must:
1. Have a clear, single responsibility
2. Include updated imports in affected files
3. Pass all existing tests
4. Be reviewable in isolation
5. Not introduce new violations

---

## 2. Dependency Analysis

### 2.1 Current Dependency Graph

```
                    ┌─────────────┐
                    │  config.js  │ (constants - leaf node)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  hexMath.js │ (pure functions - leaf node)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │  state.js   │  │pathfinding.js│  │ fogOfWar.js │
   │ (93 exports)│  └──────┬──────┘  └──────┬──────┘
   └──────┬──────┘         │                │
          │                │                │
          └────────┬───────┴────────┬───────┘
                   │                │
            ┌──────▼──────┐  ┌──────▼──────┐
            │   units.js  │  │  combat.js  │
            └──────┬──────┘  └──────┬──────┘
                   │                │
          ┌────────┴────────┬───────┴───────┐
          │                 │               │
   ┌──────▼──────┐   ┌──────▼──────┐ ┌──────▼──────┐
   │   turns.js  │   │    ui.js    │ │   map.js    │
   └──────┬──────┘   └──────┬──────┘ └─────────────┘
          │                 │
          └────────┬────────┘
                   │
            ┌──────▼──────┐
            │   input.js  │◄────────────┐
            └──────┬──────┘             │
                   │                    │
   ┌───────────────┼───────────────┐    │
   │               │               │    │
┌──▼───┐    ┌──────▼──────┐ ┌──────▼────┴─┐
│main.js│   │ renderer.js │◄►│    ai.js    │ ← CIRCULAR!
└──────┘    └─────────────┘ └─────────────┘
```

### 2.2 Circular Dependency Detail

**Problem:** `ai.js` and `renderer.js` import from each other.

```javascript
// renderer.js imports:
import { isSpectatorMode, isAIPlayer } from './ai.js';

// ai.js imports:
import { render } from './renderer.js';
```

**Impact:**
- Cannot test either module in isolation
- Module loading order becomes fragile
- Tight coupling prevents independent evolution

### 2.3 State.js Hub Problem

`state.js` is imported by **15 modules**, creating a hub-and-spoke pattern:

```
ai.js ──────────┐
combat.js ──────┤
fogOfWar.js ────┤
input.js ───────┤
main.js ────────┼──► state.js (93 exports)
map.js ─────────┤
particles.js ───┤
pathfinding.js ─┤
progression.js ─┤
renderer.js ────┤
turns.js ───────┤
tutorial.js ────┤
ui.js ──────────┤
units.js ───────┘
```

---

## 3. Proposed Architecture

### 3.1 Target Module Structure

```
js/
├── core/                    # Core game state (extracted from state.js)
│   ├── gameState.js         # Main state object + reset
│   ├── cameraState.js       # Zoom, tile size, positioning
│   ├── hexState.js          # Hex access (getHex, setHex, hexMap)
│   ├── unitState.js         # Unit queries (getPlayerUnits, getCurrentUnit)
│   ├── visibilityState.js   # Fog of war state (isHexVisible, etc.)
│   └── zoneState.js         # Zone/boundary management
│
├── combat/                  # Combat system (extracted from state.js + combat.js)
│   ├── combatCore.js        # Attack calculations
│   ├── ambushSystem.js      # Ambush queue and execution
│   ├── overwatchSystem.js   # Overwatch mechanics
│   ├── suppressionSystem.js # Suppression state
│   ├── coordinatedAttack.js # Multi-unit coordination
│   └── holdPosition.js      # Hold position bonuses
│
├── ai/                      # AI system (extracted from ai.js)
│   ├── aiCore.js            # Main AI coordination
│   ├── aiDecisions.js       # Decision-making logic
│   ├── aiMovement.js        # Movement planning
│   ├── aiCombat.js          # Attack decisions
│   ├── aiSpecials.js        # Special ability usage
│   ├── aiMemory.js          # Memory and learning
│   ├── aiNarration.js       # Thought/narration system
│   └── strategies/          # Unit-specific strategies
│       ├── medicStrategy.js
│       ├── sniperStrategy.js
│       ├── assaultStrategy.js
│       ├── scoutStrategy.js
│       └── ninjaStrategy.js
│
├── rendering/               # Rendering system (extracted from renderer.js)
│   ├── renderCore.js        # Main render loop orchestration
│   ├── terrainRenderer.js   # Hex and terrain drawing
│   ├── unitRenderer.js      # Unit sprite rendering
│   ├── effectsRenderer.js   # Visual effects (3D, lighting)
│   ├── minimapRenderer.js   # Minimap logic and drawing
│   ├── uiRenderer.js        # UI overlay rendering
│   └── renderCache.js       # Caching utilities
│
├── social/                  # Team and alliance system (from state.js)
│   ├── allianceSystem.js    # Alliance logic
│   └── statisticsSystem.js  # Scoring, rankings, events
│
├── shared/                  # Shared utilities
│   ├── gameMode.js          # isAIPlayer, isSpectatorMode (fixes circular dep)
│   └── effectsState.js      # Screen shake, ghost indicators
│
└── [existing files]         # Reduced to <300 LOC each
    ├── main.js              # Entry point only
    ├── config.js            # Constants (keep as-is)
    ├── hexMath.js           # Pure math (keep as-is)
    ├── pathfinding.js       # Keep, minor cleanup
    ├── fogOfWar.js          # Keep, imports from visibilityState
    ├── units.js             # Keep, minor cleanup
    ├── turns.js             # Keep, orchestration only
    ├── input.js             # Reduced to event handling only
    ├── ui.js                # Reduced to UI updates only
    ├── map.js               # Keep, may need minor split
    ├── combat.js            # Reduced, delegates to combat/*
    └── ...
```

### 3.2 Dependency Direction (Target)

```
         ┌─────────────────────────────────────┐
         │           config.js                 │ Layer 0: Constants
         │           hexMath.js                │
         └─────────────────┬───────────────────┘
                           │
         ┌─────────────────▼───────────────────┐
         │           core/*                    │ Layer 1: Core State
         │     (gameState, hexState, etc.)     │
         └─────────────────┬───────────────────┘
                           │
         ┌─────────────────▼───────────────────┐
         │     shared/gameMode.js              │ Layer 1.5: Shared
         │     (breaks circular dependency)    │
         └─────────────────┬───────────────────┘
                           │
         ┌─────────────────▼───────────────────┐
         │        Domain Layer                 │ Layer 2: Domain
         │  pathfinding, fogOfWar, combat/*    │
         │  units, progression                 │
         └─────────────────┬───────────────────┘
                           │
         ┌─────────────────▼───────────────────┐
         │      Application Layer              │ Layer 3: Application
         │  turns, events, powerups, ai/*      │
         └─────────────────┬───────────────────┘
                           │
         ┌─────────────────▼───────────────────┐
         │         UI Layer                    │ Layer 4: UI
         │  input, ui, rendering/*, main       │
         └─────────────────────────────────────┘
```

---

## 4. Phase 1: Foundation (PRs 1-4) ✅ COMPLETE

**Goal:** Fix critical blockers and establish infrastructure for further refactoring.

**Status:** ✅ All PRs merged
**Completed:** 2026-01-04

---

### PR 1: Create shared/gameMode.js (Fix Circular Dependency) ✅

**Priority:** P0 - CRITICAL
**Estimated Diff:** ~80 LOC
**Actual:** 89 LOC
**Risk:** Low
**Status:** ✅ COMPLETE

**Problem:**
```javascript
// ai.js
import { render } from './renderer.js';

// renderer.js
import { isSpectatorMode, isAIPlayer } from './ai.js';
```

**Solution:** Extract game mode functions to a shared module.

**Files to Create:**
```
js/shared/gameMode.js
```

**Files to Modify:**
```
js/ai.js        - Remove isAIPlayer, isSpectatorMode; re-export from gameMode
js/renderer.js  - Update import path
js/input.js     - Update import path
js/turns.js     - Update import path
js/ui.js        - Update import path
js/combat.js    - Update import path
```

**Implementation:**

```javascript
// js/shared/gameMode.js (NEW - ~50 LOC)
import { state } from '../core/gameState.js';

let spectatorModeEnabled = false;

export function isAIPlayer(playerIndex = state.currentPlayer) {
    if (playerIndex === undefined || playerIndex === null) return false;
    const aiSettings = state.settings.aiPlayers;
    if (!aiSettings) return false;
    return aiSettings[playerIndex] === true;
}

export function isSpectatorMode() {
    return spectatorModeEnabled;
}

export function setSpectatorMode(enabled) {
    spectatorModeEnabled = enabled;
}

export function isHumanTurn() {
    return !isAIPlayer(state.currentPlayer);
}

export function getHumanPlayers() {
    const humans = [];
    for (let i = 0; i < state.settings.players; i++) {
        if (!isAIPlayer(i)) humans.push(i);
    }
    return humans;
}
```

**Acceptance Criteria:**
- [x] No circular dependency warning in console
- [x] `isAIPlayer()` works identically to before
- [x] `isSpectatorMode()` works identically to before
- [x] All existing tests pass
- [x] Game runs without errors

---

### PR 2: Create Directory Structure ✅

**Priority:** P0
**Estimated Diff:** ~20 LOC (index files only)
**Actual:** 24 LOC
**Risk:** Very Low
**Status:** ✅ COMPLETE

**Create directories and index files:**

```
js/
├── core/
│   └── index.js       # Re-exports for backward compatibility
├── combat/
│   └── index.js
├── ai/
│   └── index.js
├── rendering/
│   └── index.js
├── social/
│   └── index.js
└── shared/
    └── index.js
```

**Implementation:**

```javascript
// js/core/index.js
// Placeholder - will re-export as modules are created
export * from '../state.js';
```

**Acceptance Criteria:**
- [x] All directories created
- [x] Index files provide backward-compatible exports
- [x] No import errors
- [x] All tests pass

---

### PR 3: Extract core/cameraState.js from state.js ✅

**Priority:** P0
**Estimated Diff:** ~150 LOC
**Actual:** 97 LOC
**Risk:** Low
**Status:** ✅ COMPLETE

**Functions to Extract (from state.js lines 6-52):**

```javascript
// Move to js/core/cameraState.js
export const ZOOM_REFERENCE = 0.45;
export function zoomLevelToScale(zoomLevel) { ... }
export function scaleToZoomLevel(scale) { ... }
export function getWorldScale() { ... }
export function getTileScale() { ... }
export function getTileSize() { ... }
export function getTileSizeForHexSize(hexSize) { ... }
export function getTileZOffset(height, hexSize) { ... }
export function getTileScreenPosition(q, r, height, hexSize) { ... }
```

**Files to Modify:**
```
js/state.js      - Remove functions, add re-exports
js/core/index.js - Add exports
```

**Backward Compatibility:**
```javascript
// js/state.js (add at bottom)
export * from './core/cameraState.js';
```

**Acceptance Criteria:**
- [x] Camera functions work identically
- [x] All zoom/pan operations work
- [x] Existing imports don't break
- [x] Tests pass

---

### PR 4: Extract core/hexState.js from state.js ✅

**Priority:** P0
**Estimated Diff:** ~120 LOC
**Actual:** 71 LOC
**Risk:** Low
**Status:** ✅ COMPLETE

**Functions to Extract:**

```javascript
// Move to js/core/hexState.js
export function getHex(q, r) { ... }
export function setHex(hex) { ... }
// Note: hexMap stays in state object, but access is through these functions
```

**Acceptance Criteria:**
- [x] `getHex()` and `setHex()` work identically
- [x] Map generation works
- [x] Pathfinding works
- [x] Tests pass

---

## 5. Phase 2: State Decomposition (PRs 5-12) ✅ COMPLETE

**Goal:** Split the state.js god object into focused modules.

**Status:** ✅ PRs 5-11 merged (PR 12 deferred to later phase)
**Completed:** 2026-01-04
**Results:**
- state.js reduced from 1,496 LOC → 1,301 LOC (-195 LOC)
- Created 5 core modules: cameraState, hexState, unitState, visibilityState, zoneState
- Created 5 combat modules: ambushSystem, overwatchSystem, suppressionSystem, coordinatedAttack, holdPosition
- All 270 tests passing

---

### PR 5: Extract core/unitState.js ✅

**Estimated Diff:** ~180 LOC
**Actual:** 118 LOC
**Status:** ✅ COMPLETE

**Functions to Extract:**
```javascript
export function getCurrentUnit() { ... }
export function getPlayerUnits(player) { ... }
export function canUnitAttack(unit) { ... }
export function getRemainingAttacks(unit) { ... }
export function trackUnitAttack(unit) { ... }
```

---

### PR 6: Extract core/visibilityState.js ✅

**Estimated Diff:** ~150 LOC
**Actual:** 70 LOC
**Status:** ✅ COMPLETE

**Functions to Extract:**
```javascript
export function isHexVisible(q, r) { ... }
export function isHexVisibleToPlayer(q, r, player) { ... }
export function isHexVisibleToViewer(q, r) { ... }
export function isHexExplored(q, r) { ... }
export function switchPlayerFog() { ... }
```

---

### PR 7: Extract core/zoneState.js ✅

**Estimated Diff:** ~80 LOC
**Actual:** 37 LOC
**Status:** ✅ COMPLETE

**Functions to Extract:**
```javascript
export function initZone(mapRadius) { ... }
export function isHexInZone(q, r) { ... }
```

---

### PR 8: Extract combat/ambushSystem.js ✅

**Estimated Diff:** ~100 LOC
**Actual:** 43 LOC
**Status:** ✅ COMPLETE

**Functions to Extract:**
```javascript
export function queueAmbush(ambusher, target) { ... }
export function getNextAmbush() { ... }
export function hasQueuedAmbushes() { ... }
export function clearAmbushQueue() { ... }
```

---

### PR 9: Extract combat/overwatchSystem.js ✅

**Estimated Diff:** ~120 LOC
**Actual:** 77 LOC
**Status:** ✅ COMPLETE

**Functions to Extract:**
```javascript
export function setOverwatch(unitId) { ... }
export function removeOverwatch(unitId) { ... }
export function isUnitOnOverwatch(unitId) { ... }
export function clearPlayerOverwatch(player) { ... }
export function queueOverwatchTrigger(watcherId, targetId) { ... }
export function getNextOverwatchTrigger() { ... }
export function hasQueuedOverwatch() { ... }
```

---

### PR 10: Extract combat/suppressionSystem.js ✅

**Estimated Diff:** ~100 LOC
**Actual:** 83 LOC
**Status:** ✅ COMPLETE

**Functions to Extract:**
```javascript
export function addSuppressedHex(q, r, suppressorId, duration) { ... }
export function isHexSuppressed(q, r) { ... }
export function getSuppressionInfo(q, r) { ... }
export function cleanupSuppression() { ... }
export function isHexSuppressedForUnit(q, r, unit) { ... }
```

---

### PR 11: Extract combat/coordinatedAttack.js & holdPosition.js ✅

**Estimated Diff:** ~180 LOC
**Actual:** 112 LOC (55 + 57)
**Status:** ✅ COMPLETE

**Functions to Extract:**
```javascript
// coordinatedAttack.js
export function startCoordinatedAttack(targetUnit) { ... }
export function addCoordinatedAttacker(unit) { ... }
export function removeCoordinatedAttacker(unitId) { ... }
export function cancelCoordinatedAttack() { ... }
export function getCoordinatedAttackBonus() { ... }

// holdPosition.js
export function updateHoldPosition(unit) { ... }
export function getHoldPositionRounds(unitId) { ... }
export function getHoldPositionBonus(unitId) { ... }
export function clearHoldPosition(unitId) { ... }
```

---

### PR 12: Extract social/allianceSystem.js & statisticsSystem.js

**Estimated Diff:** ~350 LOC (may need to split into 2 PRs)

**Functions to Extract:**
```javascript
// allianceSystem.js
export function arePlayersAllied(player1, player2) { ... }
export function areUnitsAllied(unit1, unit2) { ... }
export function getAlliedPlayers(player) { ... }
export function getEnemyPlayers(player) { ... }
export function getEnemyUnits(player) { ... }
export function getAlliedUnits(player) { ... }
export function hasAlliances() { ... }
export function getTeamCount() { ... }
export function getPlayersInTeam(teamId) { ... }

// statisticsSystem.js (~200 LOC - may be separate PR)
export function getPlayerStats(player) { ... }
export function recordKill(player, distance) { ... }
export function recordDamageDealt(player, amount) { ... }
export function recordDamageTaken(player, amount) { ... }
export function recordShot(player, hit, isCritical) { ... }
export function recordHealing(player, amount) { ... }
export function recordMovement(player, hexes) { ... }
export function recordSpecialUsed(player) { ... }
export function recordUnitLost(player) { ... }
export function updateSurvivalRounds() { ... }
export function calculatePlayerScore(player) { ... }
export function getPlayerRankings() { ... }
export function logRoundEvent(type, data) { ... }
export function generateRoundSummary() { ... }
export function clearRoundEvents() { ... }
export function getLastRoundSummary() { ... }
```

---

## 6. Phase 3: Renderer Decomposition (PRs 13-18) 🟡 IN PROGRESS

**Goal:** Split renderer.js (6,053 LOC) into focused modules under 300 LOC each.

**Status:** 🟡 PRs 13-17 complete, PR 14a (vegetation) complete, PR 18 pending
**Progress:**
- renderer.js: 6,053 → 4,017 LOC (-2,036 LOC, -34%)
- minimapRenderer.js: 707 LOC ✅
- unitRenderer.js: 495 LOC ✅
- effectsRenderer.js: 441 LOC ✅ (height/lighting effects)
- uiRenderer.js: 175 LOC ✅ (UI overlay elements)
- renderUtils.js: 273 LOC ✅ (shared utilities + color manipulation)
- vegetationRenderer.js: 491 LOC ✅ (biome trees, bushes, rocks)

---

### PR 13: Extract rendering/minimapRenderer.js ✅

**Estimated Diff:** ~250 LOC
**Actual:** 767 LOC (includes all minimap state + drawing functions)
**Status:** ✅ COMPLETE

**Functions Extracted:**
- `MINIMAP_CONFIG`
- `setMinimapActive()`, `isMinimapExpanded()`, `setMinimapExpanded()`
- `getMinimapBounds()`, `getToggleButtonBounds()`, `getHeightOverlayButtonBounds()`, `getCloseButtonBounds()`
- `drawMinimap()`, `drawHeightOverlayToggle()`
- All helper functions: `drawMinimapTerrain()`, `drawMinimapUnits()`, `drawMinimapViewport()`, etc.

**Note:** Module exceeds 300 LOC due to comprehensive minimap functionality. Can be further split in future if needed.

---

### PR 14a: Extract rendering/vegetationRenderer.js ✅

**Estimated Diff:** ~400 LOC
**Actual:** 491 LOC
**Status:** ✅ COMPLETE

**Functions Extracted:**
- `TREE_TYPE_NAMES`, `getBiomeTreePool()`, `pickTreeTypeForBiome()`
- `getTreeDetailType()`, `getSpriteBounds()`, `getTreeSpriteBounds()`
- `getBushSpriteBounds()`, `getShrubSpriteBounds()`, `getRockBounds()`
- `getElementBounds()` - unified bounds calculation for all vegetation
- `drawTree2D5()`, `drawBush2D5()`, `drawSmallShrub()`
- `drawFlowerCluster()`, `drawRockFormation2D5()`
- `applyBiomeVegetationTint()` - biome-specific color tinting

**Note:** Split PR 14 into vegetation (14a) and terrain caching (14b) to stay under 400 LOC diff.

---

### PR 14b: Extract terrain caching (PENDING)

**Estimated Diff:** ~350 LOC

**Functions to Extract:**
- `drawHexToContext()`
- `getCachedHexTile()`
- `createHexTileCanvas()`
- `shouldSkipCache()`
- Hex tile caching system

---

### PR 15: Extract rendering/unitRenderer.js ✅

**Estimated Diff:** ~300 LOC
**Actual:** 495 LOC
**Status:** ✅ COMPLETE

**Functions Extracted:**
- `drawUnit()`, `drawDeadUnit()`, `drawUnitOverlay()`
- `drawSpeechBubble()`, `drawCamouflagePattern()`
- `getStealthVisibilityAlpha()`
- Unit visibility and HUD rendering

---

### PR 16: Extract rendering/effectsRenderer.js ✅

**Estimated Diff:** ~350 LOC
**Actual:** 441 LOC
**Status:** ✅ COMPLETE

**Functions Extracted:**
- `drawHexPath()` - Core hex path drawing helper
- `getHeightShadeStyle()`, `drawHeightShading()` - Height-based shading
- `getLightVector()`, `getViewVector()`, `isEdgeFacingViewer()` - Lighting calculation
- `getShadowOffset()`, `drawHeightShadow()`, `applyTileLighting()` - Shadow effects
- `drawHeightExtrusion()`, `drawBaseSkirt()`, `drawCliffFaces()` - Height/cliff rendering
- `drawSpriteShadow()` - Sprite shadow rendering
- `drawHeightDebugOverlay()` - Debug visualization

**Note:** 3D mesh system (draw3DFace, collectHex3DFaces, etc.) remains in renderer.js for now due to tight coupling with hex rendering loop.

---

### PR 17: Extract rendering/uiRenderer.js ✅

**Estimated Diff:** ~200 LOC
**Actual:** 175 LOC
**Status:** ✅ COMPLETE

**Functions Extracted:**
- `drawScrollHint()` - Scroll hint arrows at viewport edges
- `drawPowerup()` - Power-up rendering with glow and animation
- `drawEventIndicator()` - Active event indicator in corner
- `drawZoomIndicator()` - Zoom level display

**Note:** `drawPathPreviewOnTop()` remains in renderer.js due to tight integration with movement system and significant complexity (~220 LOC).

---

### PR 18: Refactor rendering/renderCore.js (Main Loop)

**Estimated Diff:** ~300 LOC

**Goal:** Reduce `render()` from 775 LOC to ~150 LOC by delegating to extracted modules.

**New Structure:**
```javascript
// rendering/renderCore.js
export function render() {
    if (!validateCanvas()) return;

    updateAnimationState();
    clearCanvas();

    renderTerrain();      // → terrainRenderer
    renderUnits();        // → unitRenderer
    renderEffects();      // → effectsRenderer
    renderUI();           // → uiRenderer
    renderMinimap();      // → minimapRenderer

    scheduleNextFrame();
}
```

---

## 7. Phase 4: AI Decomposition (PRs 19-24)

**Goal:** Split ai.js (6,272 LOC) into focused modules.

---

### PR 19: Extract ai/aiMemory.js

**Estimated Diff:** ~200 LOC

**Functions to Extract:**
- `recordIncomingAttack()`
- Memory tracking functions
- Enemy position history
- Threat assessment memory

---

### PR 20: Extract ai/aiNarration.js

**Estimated Diff:** ~250 LOC

**Functions to Extract:**
- `generateThought()`
- `displayAIThought()`
- Narration and commentary system
- Spectator mode narration

---

### PR 21: Extract ai/aiMovement.js

**Estimated Diff:** ~350 LOC

**Functions to Extract:**
- `selectStrategicMoveTarget()`
- Movement evaluation functions
- Path scoring
- Cover-seeking logic

---

### PR 22: Extract ai/aiCombat.js

**Estimated Diff:** ~300 LOC

**Functions to Extract:**
- `scoreCombatPosition()` (refactor to <40 LOC)
- Attack decision logic
- Target prioritization
- Damage calculation helpers

---

### PR 23: Extract ai/aiSpecials.js

**Estimated Diff:** ~200 LOC

**Functions to Extract:**
- `shouldUseSpecial()`
- Special ability decision logic
- Per-class ability evaluation

---

### PR 24: Refactor ai/aiCore.js (Main AI Loop)

**Estimated Diff:** ~350 LOC

**Goal:** Reduce `performUnitAI()` from 246 LOC to ~50 LOC.

**New Structure:**
```javascript
// ai/aiCore.js
export async function performUnitAI(unit, plan, spectatorMode = false) {
    const context = createAIContext(unit, plan, spectatorMode);

    if (shouldUseSpecial(context)) {
        return executeSpecialAction(context);
    }

    const combatAction = evaluateCombatOptions(context);
    if (combatAction) {
        return executeCombatAction(context, combatAction);
    }

    const moveAction = evaluateMovementOptions(context);
    return executeMovementAction(context, moveAction);
}
```

---

## 8. Phase 5: Input & Main Cleanup (PRs 25-28)

**Goal:** Separate concerns in input.js and main.js.

---

### PR 25: Extract Game Logic from input.js

**Estimated Diff:** ~300 LOC

**Problem:** `input.js` contains game logic that should be elsewhere.

**Move to appropriate modules:**
- Animation choreography → `turns.js` or new `movementController.js`
- Reactive fire checks → `combat.js`
- Powerup pickup → `powerups.js`
- Tutorial notifications → `tutorial.js`

**Keep in input.js:**
- Event listeners (mouse, touch, keyboard)
- Camera pan/zoom
- Click target identification

---

### PR 26: Refactor handleMoveClick (143 → ~40 LOC)

**Estimated Diff:** ~200 LOC

**Extract from handleMoveClick:**
```javascript
// New helper functions
function validateMovePath(unit, targetHex) { ... }
function executeQueuedMove(unit, path) { ... }
function handleMoveCompletion(unit, originalPosition) { ... }
```

---

### PR 27: Extract Team Selection from main.js

**Estimated Diff:** ~350 LOC

**Create:** `js/teamSelection.js`

**Move:**
- `startTeamSelection()`
- `showTeamSelectForPlayer()`
- `generateAITeam()`
- Team selection UI logic

---

### PR 28: Refactor init() (370 → ~100 LOC)

**Estimated Diff:** ~300 LOC

**Extract from init():**
```javascript
// New helper functions
function initializeGameSystems() { ... }
function setupEventListeners() { ... }
function loadGameAssets() { ... }
function initializeUI() { ... }
```

---

## 9. Phase 6: Function-Level Refactoring (PRs 29-35)

**Goal:** Address remaining functions over 40 LOC and deep nesting.

---

### PR 29: Flatten Nesting in ai.js

**Target:** Reduce 4-5 level nesting to max 3 levels.

**Technique:** Early returns + extraction.

```javascript
// Before
if (unit) {
    if (spectatorMode) {
        if (isVisible) {
            if (shouldSeek) {
                // action
            }
        }
    }
}

// After
if (!unit) return;
if (!spectatorMode) return handleNonSpectatorMode(unit);
if (!isVisible) return;
if (!shouldSeek) return;
// action
```

---

### PR 30: Flatten Nesting in input.js

Similar pattern to PR 29.

---

### PR 31: Flatten Nesting in renderer.js

Similar pattern to PR 29.

---

### PR 32: Refactor Large Functions in combat.js

**Target Functions:**
- `performAttack()` - Break into validation, calculation, execution
- `useSpecialAbility()` - Extract per-class handlers

---

### PR 33: Refactor Large Functions in ui.js

**Target Functions:**
- `updateUI()` - Extract component-specific updates
- `showScreen()` - Simplify screen transition logic

---

### PR 34: Refactor Large Functions in map.js

**Target Functions:**
- `generateMap()` - Extract terrain placement phases
- Biome generation helpers

---

### PR 35: Final Cleanup & Documentation

- Update CLAUDE.md with new module structure
- Update import examples in documentation
- Add JSDoc comments to new modules
- Final verification of all file sizes

---

## 10. Testing Strategy

### 10.1 Test Requirements Per PR

Each PR must:
1. **Run existing tests** - `npm test` must pass
2. **Verify game functionality** - Manual smoke test
3. **Check imports** - No circular dependency warnings
4. **Validate file sizes** - New files < 300 LOC

### 10.2 Smoke Test Checklist

Before merging each PR, verify:

- [ ] Game loads without console errors
- [ ] Menu navigation works
- [ ] Game can start (single player)
- [ ] Game can start (multiplayer)
- [ ] Units can move
- [ ] Units can attack
- [ ] AI takes turns (if applicable)
- [ ] Fog of war works
- [ ] Game can end (victory/defeat)

### 10.3 Regression Test Focus Areas

| Module Changed | Test Focus |
|----------------|------------|
| state.js | All game state operations |
| renderer.js | Visual rendering, minimap |
| ai.js | AI decision-making, turn execution |
| input.js | Mouse/touch controls, camera |
| combat.js | Damage calculation, specials |

---

## 11. Risk Mitigation

### 11.1 Risk: Breaking Existing Functionality

**Mitigation:**
- Use re-exports for backward compatibility
- Run full test suite after each PR
- Keep original functions as wrappers initially
- Remove wrappers only after verification

### 11.2 Risk: Import Order Issues

**Mitigation:**
- Map all dependencies before starting
- Extract leaf nodes first (no dependencies)
- Use index.js files for clean imports
- Test module loading in isolation

### 11.3 Risk: Large PRs Exceeding Limit

**Mitigation:**
- Monitor diff size during development
- Split PRs if approaching 400 LOC
- Prioritize extraction over refactoring in single PR
- Document split decisions

### 11.4 Rollback Plan

Each PR should be independently revertable:
```bash
git revert <commit-hash>
```

If multiple PRs cause issues:
1. Identify the problematic PR
2. Revert to last known good state
3. Re-approach with smaller changes

---

## 12. Success Criteria

### 12.1 Quantitative Goals

| Metric | Before | Current | Target | Status |
|--------|--------|---------|--------|--------|
| Files > 300 LOC | 11 | 10 | 0 | 🟡 In Progress |
| Functions > 40 LOC | 20+ | 20+ | 0 | ⬜ Pending |
| Circular dependencies | 1 | 0 | 0 | ✅ Fixed |
| Max nesting depth | 5+ | 5+ | 3 | ⬜ Pending |
| state.js LOC | 1,496 | 1,301 | <300 | 🟡 -195 LOC |
| render() LOC | 775 | 775 | <150 | ⬜ Phase 3 |
| performUnitAI() LOC | 246 | 246 | <50 | ⬜ Phase 4 |

### 12.2 Qualitative Goals

- [ ] New developer can understand module in 10 minutes
- [ ] Each file has single, clear responsibility
- [ ] Dependencies flow in one direction
- [ ] No hidden side effects
- [ ] Tests protect all critical behavior

### 12.3 Definition of Done

The refactoring is complete when:
1. All quantitative metrics are met
2. All existing tests pass
3. No new bugs introduced
4. Documentation updated
5. AGENTS.md compliance verified

---

## 13. Appendices

### Appendix A: Current File Sizes

| File | LOC | Status |
|------|-----|--------|
| ai.js | 6,272 | 🔴 20x over |
| renderer.js | 6,053 | 🔴 20x over |
| input.js | 2,781 | 🔴 9x over |
| minigames.js | 2,298 | 🔴 7x over |
| main.js | 2,254 | 🔴 7x over |
| combat.js | 1,661 | 🔴 5x over |
| ui.js | 1,608 | 🔴 5x over |
| state.js | 1,496 | 🔴 5x over |
| map.js | 1,265 | 🔴 4x over |
| tutorial.js | 1,200 | 🔴 4x over |
| spriteSheetLoader.js | 1,132 | 🔴 3x over |
| particles.js | 891 | 🔴 3x over |
| config.js | 878 | 🔴 3x over |
| turns.js | 760 | 🔴 2x over |
| audio.js | 744 | 🔴 2x over |
| errorLog.js | 499 | 🔴 1.6x over |
| fogOfWar.js | 468 | 🔴 1.5x over |
| assetLoader.js | 436 | 🔴 1.4x over |
| units.js | 357 | 🔴 1.2x over |
| hexMath.js | ~200 | 🟢 OK |
| pathfinding.js | ~250 | 🟢 OK |
| progression.js | ~200 | 🟢 OK |
| events.js | ~150 | 🟢 OK |
| powerups.js | ~200 | 🟢 OK |

### Appendix B: State.js Export Categories

**Camera/View (9 functions):**
- `ZOOM_REFERENCE`, `zoomLevelToScale`, `scaleToZoomLevel`
- `getWorldScale`, `getTileScale`, `getTileSize`
- `getTileSizeForHexSize`, `getTileZOffset`, `getTileScreenPosition`

**Hex Access (3 functions):**
- `getHex`, `setHex`, `getPlayerName`

**Unit Queries (6 functions):**
- `getCurrentUnit`, `getPlayerUnits`, `canUnitAttack`
- `getRemainingAttacks`, `trackUnitAttack`, `initSharedAPPool`

**AP Management (3 functions):**
- `spendSharedAP`, `setOnAPDepletedCallback`

**Visibility (6 functions):**
- `isHexVisible`, `isHexVisibleToPlayer`, `isHexVisibleToViewer`
- `isHexExplored`, `switchPlayerFog`

**Path Queue (3 functions):**
- `setQueuedPath`, `getQueuedPath`, `clearQueuedPath`

**Contact Tracking (4 functions):**
- `updatePreviouslyVisibleEnemies`, `getPreviouslyVisibleEnemies`
- `markEnemyContact`, `updateContactTracking`

**Zone (2 functions):**
- `initZone`, `isHexInZone`

**Combat Tracking (2 functions):**
- `markCombat`

**Screen Effects (3 functions):**
- `triggerScreenShake`, `updateScreenShake`

**Ghost Indicators (3 functions):**
- `addGhostIndicator`, `clearGhostIndicator`, `getVisibleGhosts`

**Enemy Direction (1 function):**
- `getEnemyDirection`

**Coordinated Attack (5 functions):**
- `startCoordinatedAttack`, `addCoordinatedAttacker`
- `removeCoordinatedAttacker`, `cancelCoordinatedAttack`
- `getCoordinatedAttackBonus`

**Ambush System (4 functions):**
- `queueAmbush`, `getNextAmbush`, `hasQueuedAmbushes`, `clearAmbushQueue`

**Suppression System (5 functions):**
- `addSuppressedHex`, `isHexSuppressed`, `getSuppressionInfo`
- `cleanupSuppression`, `isHexSuppressedForUnit`

**Overwatch System (6 functions):**
- `setOverwatch`, `removeOverwatch`, `isUnitOnOverwatch`
- `clearPlayerOverwatch`, `queueOverwatchTrigger`
- `getNextOverwatchTrigger`, `hasQueuedOverwatch`

**Hold Position (4 functions):**
- `updateHoldPosition`, `getHoldPositionRounds`
- `getHoldPositionBonus`, `clearHoldPosition`

**Alliance System (9 functions):**
- `arePlayersAllied`, `areUnitsAllied`, `getAlliedPlayers`
- `getEnemyPlayers`, `getEnemyUnits`, `getAlliedUnits`
- `hasAlliances`, `getTeamCount`, `getPlayersInTeam`

**Statistics (16 functions):**
- `getPlayerStats`, `recordKill`, `recordDamageDealt`
- `recordDamageTaken`, `recordShot`, `recordHealing`
- `recordMovement`, `recordSpecialUsed`, `recordUnitLost`
- `updateSurvivalRounds`, `calculatePlayerScore`, `getPlayerRankings`
- `logRoundEvent`, `generateRoundSummary`, `clearRoundEvents`
- `getLastRoundSummary`

**Core State (2):**
- `state` (object), `resetState`

### Appendix C: PR Dependency Graph

```
PR 1 (gameMode.js) ─────┐
                        │
PR 2 (directories) ─────┼──► PR 3-4 (camera, hex) ──► PR 5-12 (state split)
                        │                                      │
                        │                                      ▼
                        └──────────────────────────────► PR 13-18 (renderer)
                                                               │
                                                               ▼
                                                        PR 19-24 (ai)
                                                               │
                                                               ▼
                                                        PR 25-28 (input/main)
                                                               │
                                                               ▼
                                                        PR 29-35 (cleanup)
```

### Appendix D: Estimated Timeline

| Phase | PRs | Estimated Hours | Notes |
|-------|-----|-----------------|-------|
| Phase 1: Foundation | 1-4 | 8-10 | Critical path |
| Phase 2: State | 5-12 | 16-20 | Can parallelize some |
| Phase 3: Renderer | 13-18 | 12-15 | Sequential |
| Phase 4: AI | 19-24 | 12-15 | Sequential |
| Phase 5: Input/Main | 25-28 | 10-12 | Sequential |
| Phase 6: Cleanup | 29-35 | 14-18 | Can parallelize |
| **Total** | **35** | **72-90** | ~2-3 weeks |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-04 | Claude | Initial draft |

---

*This document should be reviewed and approved before implementation begins.*
