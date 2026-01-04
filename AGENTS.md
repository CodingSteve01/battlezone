# AGENTS.md - AI Coding Agent Guide for Shadow Squad

## Coding Agent Manifest — Architecture, Maintainability & Quality

### Purpose
This document defines binding rules for all coding agents that create or modify code in this repository.
The goal is long-term maintainability, clear architecture, and controlled growth of the codebase.

**Success criterion:**
Code must not only work, but remain understandable, testable, and extensible.

---

### 1. Core Principles (Non‑Negotiable)

**1.1 Architecture before implementation**
- Before writing code, produce a short architecture sketch covering:
  - affected modules/layers
  - responsibilities
  - new or changed interfaces
- Direct implementation without an architectural thought process is not allowed.

**1.2 Small, reviewable steps**
- Large changes must be split into small, PR‑ready steps.
- Each step must:
  - compile / run
  - be understandable in isolation
  - have a clear responsibility

---

### 2. File Size & Structure (Avoid Monoliths)

**2.1 File size rules**
- Max 300 LOC per file
- Max 40 LOC per function
- Exceeding limits is only allowed if:
  - an explicit justification is provided
  - a split proposal is documented

**2.2 Responsibility separation**
- One file = one primary responsibility
- Mixed concerns (UI + logic + data access in one file) are not allowed

Examples:
- UI components contain no business logic
- Services contain no UI details
- Domain code knows no infrastructure

---

### 3. Layers & Dependencies

**3.1 Dependency direction (mandatory)**

UI → Application → Domain
Infrastructure → Application

- Domain must not depend on outer layers
- UI must not talk to infrastructure directly
- Infrastructure implements interfaces defined higher up

**3.2 Interfaces first**
- New logic starts with:
  - interfaces / ports
  - DTOs / types
  - tests (when reasonable)
- Implementations follow afterwards

---

### 4. Code Quality & Readability

**4.1 Control flow**
- Prefer early returns over deep nesting ("never‑nester")
- Max 3 nesting levels
- No "clever" one‑liners at the expense of clarity

**4.2 Explicit over implicit**
- No hidden side effects
- No magic via global state
- Dependencies are passed explicitly

---

### 5. Tests & Behavior

**5.1 Tests are part of implementation**
- New logic requires matching tests
- Refactors without behavior change:
  - golden‑master or existing tests must remain green

**5.2 No test alibi**
- Snapshot or "it runs" tests do not replace logic tests
- Tests must protect behavior, not implementation details

---

### 6. Change Scope & PR Discipline

**6.1 Change size**
- Guideline: ≤ 400 LOC diff per PR
- Larger changes must be split

**6.2 Not "just adding"**
- When adding code, check:
  - can existing code be simplified?
  - is an extraction due?
  - growth without refactoring is not acceptable

---

### 7. Refactoring Rules

**7.1 Continuous cleanup**
- When thresholds are reached (LOC, complexity):
  - extract into new modules
  - rename for clarity
  - reduce coupling

**7.2 Safety first**
- Refactors must not change behavior
- Tests must pass before and after

---

### 8. Agent Self‑Review

Before finishing a change, the agent must verify:
- Did the architecture become clearer or just larger?
- Is the new logic isolated and testable?
- Did any file grow unhealthy?
- Were responsibilities mixed?
- Would a new developer understand this in 10 minutes?

If any answer is "no", further work is required.

---

### 9. Expected Agent Behavior

The agent is not a pure code generator, but:
- an architecture co‑thinker
- a maintainability guardian
- a refactoring partner

**Optimization goal:**
Minimize future change costs, not maximize short‑term feature speed.

---

### 10. Binding Nature

This manifesto is part of the working agreement.
Deviations are only allowed after explicit coordination.


## Coding Agent Manifest – Architektur, Wartbarkeit & Qualität

### Zweck
Dieses Dokument definiert verbindliche Regeln für alle Coding-Agents, die in diesem Repository Code erzeugen oder verändern.
Ziel ist langfristige Wartbarkeit, klare Architektur und kontrolliertes Wachstum der Codebasis.

**Erfolgskriterium:**
Code muss nicht nur funktionieren, sondern verständlich, testbar und erweiterbar bleiben.

---

### 1. Grundprinzipien (nicht verhandelbar)

**1.1 Architektur vor Implementierung**
- Bevor Code geschrieben wird, muss eine kurze Architektur-Skizze erfolgen:
  - betroffene Module / Layer
  - Verantwortlichkeiten
  - neue oder geänderte Schnittstellen
- Direkte Implementierung ohne Architekturüberlegung ist nicht zulässig.

**1.2 Kleine, überprüfbare Schritte**
- Große Änderungen sind in mehrere kleine PR-fähige Schritte zu zerlegen.
- Jeder Schritt muss:
  - kompilieren / laufen
  - isoliert verständlich sein
  - eine klare Verantwortung haben

---

### 2. Dateigröße & Struktur (Monolith-Vermeidung)

**2.1 Dateigrößen-Regeln**
- Maximal 300 LOC pro Datei
- Maximal 40 LOC pro Funktion
- Überschreitungen sind nur erlaubt, wenn:
  - eine explizite Begründung geliefert wird
  - ein Split-Vorschlag dokumentiert ist

**2.2 Verantwortungstrennung**
- Eine Datei = eine primäre Verantwortung
- Mischformen (UI + Logik + Datenzugriff in einer Datei) sind nicht erlaubt

Beispiele:
- UI-Komponenten enthalten keine Geschäftslogik
- Services enthalten keine UI-Details
- Domain-Code kennt keine Infrastruktur

---

### 3. Schichten & Abhängigkeiten

**3.1 Abhängigkeitsrichtung (zwingend)**

UI → Application → Domain
Infrastructure → Application

- Domain darf keine Abhängigkeiten nach außen haben
- UI darf keine Infrastruktur direkt ansprechen
- Infrastruktur implementiert Interfaces, die höher definiert sind

**3.2 Schnittstellen zuerst**
- Neue Logik beginnt mit:
  - Interfaces / Ports
  - DTOs / Typen
  - Tests (sofern sinnvoll)
- Implementierungen folgen danach

---

### 4. Code-Qualität & Lesbarkeit

**4.1 Kontrollfluss**
- Early Returns statt tiefer Verschachtelung ("never-nester")
- Maximal 3 Ebenen Verschachtelung
- Keine „cleveren“ Einzeiler auf Kosten der Lesbarkeit

**4.2 Explizit statt implizit**
- Keine versteckten Seiteneffekte
- Keine Magie durch globale Zustände
- Abhängigkeiten werden explizit übergeben

---

### 5. Tests & Verhalten

**5.1 Tests sind Teil der Implementierung**
- Neue Logik benötigt passende Tests
- Refactorings ohne Verhaltensänderung:
  - Golden-Master oder bestehende Tests müssen bestehen bleiben

**5.2 Kein Test-Alibi**
- Snapshot- oder „es läuft“-Tests ersetzen keine Logiktests
- Tests müssen Verhalten absichern, nicht Implementierungsdetails

---

### 6. Änderungsumfang & Pull-Request-Disziplin

**6.1 Änderungsgröße**
- Richtwert: ≤ 400 LOC Diff pro PR
- Größere Änderungen müssen aufgeteilt werden

**6.2 Kein „nur hinzufügen“**
- Wenn Code hinzugefügt wird, ist zu prüfen:
  - Kann bestehender Code vereinfacht werden?
  - Ist eine Extraktion fällig?
  - Wachstum ohne Refactoring ist nicht akzeptabel

---

### 7. Refactoring-Regeln

**7.1 Kontinuierliches Aufräumen**
- Bei Erreichen von Grenzwerten (LOC, Komplexität):
  - Extraktion in neue Module
  - Umbenennung für Klarheit
  - Reduktion von Kopplung

**7.2 Sicherheit zuerst**
- Refactorings dürfen kein Verhalten ändern
- Tests müssen vor und nach dem Refactoring bestehen

---

### 8. Selbst-Review durch den Agenten

Vor Abschluss einer Änderung muss der Agent selbst prüfen:
- Wurde Architektur klarer oder nur größer?
- Ist die neue Logik isoliert testbar?
- Ist eine Datei ungesund gewachsen?
- Wurden Verantwortlichkeiten vermischt?
- Würde ein neuer Entwickler das in 10 Minuten verstehen?

Wenn eine Frage mit „nein“ beantwortet wird, ist Nacharbeit erforderlich.

---

### 9. Erwartetes Agent-Verhalten

Der Agent ist kein reiner Code-Generator, sondern:
- Architektur-Mitdenker
- Wartbarkeits-Bewahrer
- Refactoring-Partner

**Optimierungsziel:**
Minimierung zukünftiger Änderungs-Kosten, nicht Maximierung aktueller Feature-Geschwindigkeit.

---

### 10. Verbindlichkeit

Dieses Manifest ist Teil der Arbeitsgrundlage.
Abweichungen sind nur nach expliziter Rücksprache erlaubt.


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
