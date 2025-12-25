# Sprite Sheet System

Das Sprite-Sheet-System ermöglicht es, Grafiken aus Sprite-Sheets zu extrahieren und im Spiel zu verwenden. Es basiert auf JSON-Definitionen, die genau beschreiben, wo sich jedes Sprite im Quellbild befindet.

## Verzeichnisstruktur

```
assets/spritesheets/
├── README.md               # Diese Dokumentation
├── schema.json             # JSON Schema für Validierung
├── unit-sprites.json       # Definition für Einheiten-Sprites
├── terrain-hexes.json      # Definition für Terrain-Hexes
├── environment-details.json # Definition für Umgebungsdetails
├── unit-sprites.png        # Quell-Sprite-Sheet (Einheiten)
├── terrain-hexes.png       # Quell-Sprite-Sheet (Terrain)
└── environment-details.png # Quell-Sprite-Sheet (Details)
```

## Workflow

### 1. Sprite Sheet vorbereiten

Erstelle ein PNG-Bild mit allen Sprites. Idealerweise mit transparentem Hintergrund.

### 2. JSON-Definition erstellen

Erstelle eine JSON-Datei, die beschreibt, wo jedes Sprite im Bild liegt:

```json
{
  "version": "1.0",
  "source": "mein-spritesheet.png",
  "type": "terrain",
  "globalSettings": {
    "outputSize": { "width": 256, "height": 256 },
    "backgroundRemoval": {
      "enabled": true,
      "color": "#ffffff",
      "tolerance": 15
    }
  },
  "sprites": [
    {
      "id": "grass",
      "name": "Gras",
      "bounds": { "x": 0, "y": 0, "width": 220, "height": 250 },
      "metadata": { "terrainType": "grass", "variant": 0 }
    }
  ]
}
```

### 3. Sprites extrahieren (Browser-Tool)

1. Öffne `tools/spritesheet-processor.html` im Browser
2. Lade das Sprite-Sheet-Bild
3. Lade die JSON-Definition (oder wähle eine Vorlage)
4. Passe die Bounds interaktiv an
5. Extrahiere und exportiere die Sprites als ZIP

### 4. Sprites ins Spiel integrieren

Lege die extrahierten PNGs in die entsprechenden Ordner:
- `assets/terrain/` für Terrain-Texturen
- `assets/units/` für Einheiten-Sprites
- `assets/details/` für Umgebungsdetails

Das Spiel lädt die Sprites automatisch beim Start.

## JSON-Schema Referenz

### Globale Einstellungen (`globalSettings`)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `outputSize.width` | number | Ausgabebreite in Pixeln |
| `outputSize.height` | number | Ausgabehöhe in Pixeln |
| `backgroundRemoval.enabled` | boolean | Hintergrund entfernen? |
| `backgroundRemoval.color` | string | Hintergrundfarbe (hex oder "auto") |
| `backgroundRemoval.tolerance` | number | Farbtoleranz (0-255) |

### Sprite-Definition (`sprites[]`)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Eindeutige ID (wird als Dateiname verwendet) |
| `name` | string | Anzeigename |
| `bounds.x` | number | X-Position im Quellbild |
| `bounds.y` | number | Y-Position im Quellbild |
| `bounds.width` | number | Breite im Quellbild |
| `bounds.height` | number | Höhe im Quellbild |
| `outputSize` | object | Überschreibt globale Ausgabegröße |
| `anchor` | object | Ankerpunkt (0-1, relativ zu bounds) |
| `flipX` | boolean | Horizontal spiegeln |
| `flipY` | boolean | Vertikal spiegeln |
| `rotation` | number | Rotation in Grad |
| `metadata` | object | Zusätzliche Metadaten |

### Metadata-Felder

Je nach Sprite-Typ unterschiedliche Felder:

**Terrain:**
```json
"metadata": { "terrainType": "grass", "variant": 0 }
```

**Units:**
```json
"metadata": { "unitClass": "scout", "state": "normal" }
```

**Details:**
```json
"metadata": { "detailType": "tree", "variant": 0 }
```

## Sprite-Typen

### Terrain (`type: "terrain"`)

Hexagonale Terrain-Texturen. Das Spiel wählt automatisch eine Variante basierend auf der Hex-Position.

Unterstützte `terrainType` Werte:
- `grass`, `forest`, `rock`, `water`, `sand`, `swamp`, `hills`, `road`, `path`, `river`

### Units (`type: "units"`)

Einheiten-Sprites mit Spielerfarben-Varianten.

Unterstützte `unitClass` Werte:
- `scout`, `assault`, `medic`, `sniper`, `ninja`

Unterstützte `state` Werte:
- `normal`, `cover`, `attack`, `dead`, `selected`

### Details (`type: "details"`)

Umgebungsdetails wie Bäume, Büsche, Gras.

Unterstützte `detailType` Werte:
- `tree`, `bush`, `grass`, `rock`

## Dynamische Varianten

Das System erkennt automatisch neue Varianten. Um eine neue Gras-Variante hinzuzufügen:

1. Füge einen neuen Eintrag in `terrain-hexes.json` hinzu:
```json
{
  "id": "grass_v4",
  "name": "Gras Variante 4",
  "bounds": { "x": 0, "y": 0, "width": 220, "height": 250 },
  "metadata": { "terrainType": "grass", "variant": 4 }
}
```

2. Extrahiere das Sprite und lege es als `grass_v4.png` ab

Das Spiel verwendet die neue Variante automatisch.

## Spielerfarben (Units)

Für Einheiten können automatisch Spielerfarben-Varianten generiert werden:

```json
"colorize": {
  "enabled": true,
  "targetColors": ["#22c55e", "#ef4444", "#3b82f6", "#eab308"]
}
```

Dies erzeugt für jedes Basis-Sprite vier farbige Varianten (Spieler 1-4).

## Fallback-System

Das Asset-System hat drei Fallback-Ebenen:

1. **Sprite Sheets** - JSON-definierte Sprites
2. **Statische PNGs** - Einzelne PNG-Dateien
3. **Runtime-Generierung** - Zur Laufzeit gerendert

Wenn keine Sprites gefunden werden, rendert das Spiel die Grafiken selbst.
