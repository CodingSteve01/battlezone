// ===== FIRST-USE EXPLANATIONS FOR TACTICAL FEATURES =====
// Shows detailed explanation the first time a player uses a feature

/**
 * Explanations for tactical features, shown on first use
 */
export const FIRST_USE_EXPLANATIONS = {
    overwatch: {
        title: '👁️ Overwatch - Deckungsfeuer',
        message: `<b>So funktioniert Overwatch:</b><br><br>
            ⏳ Deine Einheit wartet auf feindliche Bewegung<br>
            🎯 Wenn ein Feind in Reichweite läuft → <b>automatischer Angriff!</b><br>
            ⚡ Schaden: 70% des normalen Schadens (Reaktionsschuss)<br><br>
            <b>Tipp:</b> Ideal um Engpässe und Flanken zu sichern!`
    },
    ambush: {
        title: '🎯 Hinterhalt',
        message: `<b>So funktioniert der Hinterhalt:</b><br><br>
            🌲 Nur aus Tarnung oder Deckung möglich<br>
            ⏳ Deine Einheit lauert auf Feinde<br>
            💥 Feind in Reichweite → <b>automatischer Angriff mit Bonus-Schaden!</b><br><br>
            <b>Tipp:</b> Perfekt für Commando und Sniper nach Tarnung!`
    },
    suppress: {
        title: '🔥 Unterdrückungsfeuer',
        message: `<b>So funktioniert Unterdrückung:</b><br><br>
            🎯 Wähle ein Hex-Feld in Reichweite<br>
            🔥 Feinde auf diesem Feld werden "festgenagelt":<br>
            &nbsp;&nbsp;• <b>-30% Trefferchance</b> für unterdrückte Feinde<br>
            &nbsp;&nbsp;• <b>+1 Bewegungskosten</b> zum Verlassen<br><br>
            <b>Tipp:</b> Unterdrücke feindliche Sniper-Positionen!`
    },
    coordinate: {
        title: '👥 Koordinierter Angriff',
        message: `<b>So funktioniert koordinierter Angriff:</b><br><br>
            🎯 Mehrere Einheiten müssen das gleiche Ziel in Reichweite haben<br>
            💥 Alle greifen gleichzeitig an mit <b>+15% Schaden pro Angreifer!</b><br><br>
            <b>Beispiel:</b> 3 Einheiten = +30% Bonus-Schaden für alle!<br><br>
            <b>Tipp:</b> Ideal um starke Gegner schnell auszuschalten!`
    }
};

// Track which explanations have been shown
let shownExplanations = new Set();

// Load from localStorage
try {
    const saved = localStorage.getItem('shadowSquad_tacticalExplanations');
    if (saved) {
        shownExplanations = new Set(JSON.parse(saved));
    }
} catch { /* ignore */ }

/**
 * Show first-use explanation for a tactical feature
 * Returns true if explanation was shown (first time), false otherwise
 * @param {string} featureId - ID of the feature to show explanation for
 * @returns {boolean} Whether the explanation was shown
 */
export function showFirstUseExplanation(featureId) {
    if (shownExplanations.has(featureId)) {
        return false; // Already shown
    }

    const explanation = FIRST_USE_EXPLANATIONS[featureId];
    if (!explanation) return false;

    // Mark as shown
    shownExplanations.add(featureId);
    try {
        localStorage.setItem('shadowSquad_tacticalExplanations', JSON.stringify([...shownExplanations]));
    } catch { /* ignore */ }

    // Create modal overlay
    let overlay = document.getElementById('tactical-explanation-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tactical-explanation-overlay';
        overlay.className = 'tutorial-overlay tutorial-center';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="tutorial-hint tactical-hint">
            <div class="tutorial-hint-header">
                <span class="tutorial-hint-title">${explanation.title}</span>
            </div>
            <div class="tutorial-hint-message">${explanation.message}</div>
            <div class="tutorial-hint-actions">
                <button class="tutorial-btn tutorial-btn-ok" onclick="document.getElementById('tactical-explanation-overlay').style.display='none'">
                    ✓ Verstanden!
                </button>
            </div>
        </div>
    `;

    overlay.style.display = 'flex';
    return true;
}

/**
 * Check if an explanation has been shown
 * @param {string} featureId - ID of the feature
 * @returns {boolean} Whether the explanation has been shown
 */
export function hasSeenExplanation(featureId) {
    return shownExplanations.has(featureId);
}

/**
 * Reset all shown explanations (for testing)
 */
export function resetExplanations() {
    shownExplanations.clear();
    try {
        localStorage.removeItem('shadowSquad_tacticalExplanations');
    } catch { /* ignore */ }
}
