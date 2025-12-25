// ===== AUDIO SYSTEM =====
// Prozedural generierte Sounds mit Web Audio API

let audioContext = null;
let masterGain = null;
let initialized = false;

// Audio-Einstellungen
export const audioSettings = {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    ambientVolume: 0.3,
    enabled: true
};

// Ambient-Sound-Loop-Referenz
let ambientSource = null;
let ambientGain = null;

/**
 * Initialisiert das Audio-System (muss nach User-Interaktion aufgerufen werden)
 */
export function initAudio() {
    if (initialized) return true;

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        masterGain.gain.value = audioSettings.masterVolume;
        initialized = true;
        console.log('Audio-System initialisiert');
        return true;
    } catch (e) {
        console.warn('Web Audio API nicht verfügbar:', e);
        return false;
    }
}

/**
 * Stellt sicher, dass AudioContext läuft (nach User-Interaktion)
 * Gibt true zurück wenn Audio bereit ist
 */
export function resumeAudio() {
    if (!initialized) {
        initAudio();
    }
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.warn('Audio resume failed:', e));
    }
    return initialized && audioContext && audioContext.state === 'running';
}

/**
 * Hilfsfunktion: Stellt sicher, dass Audio bereit ist bevor Sound abgespielt wird
 * Sollte bei jeder Sound-Wiedergabe aufgerufen werden
 */
function ensureAudioReady() {
    if (!initialized) {
        initAudio();
    }
    if (audioContext && audioContext.state === 'suspended') {
        // Try to resume - this will only work after user interaction
        audioContext.resume().catch(() => {});
    }
    // Allow playing even if state is 'suspended' - the sound will play once resumed
    // This fixes the race condition where resume() hasn't completed yet
    return audioContext !== null;
}

/**
 * Setzt Master-Lautstärke
 */
export function setMasterVolume(value) {
    audioSettings.masterVolume = Math.max(0, Math.min(1, value));
    if (masterGain) {
        masterGain.gain.value = audioSettings.masterVolume;
    }
}

/**
 * Aktiviert/Deaktiviert Audio
 */
export function toggleAudio(enabled) {
    audioSettings.enabled = enabled;
    if (masterGain) {
        masterGain.gain.value = enabled ? audioSettings.masterVolume : 0;
    }
}

// ===== SOUND GENERATOREN =====

/**
 * Erstellt einen Oszillator mit Envelope
 */
function createOscillator(frequency, type = 'sine', duration = 0.1) {
    // Ensure audio is ready - this will try to init/resume if needed
    if (!ensureAudioReady() || !audioSettings.enabled) return null;
    if (!audioContext || !masterGain) return null;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    osc.connect(gain);
    gain.connect(masterGain);

    return { osc, gain, duration };
}

/**
 * Spielt einen Ton mit Attack-Decay-Envelope
 */
function playTone(frequency, type = 'sine', duration = 0.1, volume = 0.3, attack = 0.01, decay = 0.1) {
    const sound = createOscillator(frequency, type, duration);
    if (!sound) return;

    const { osc, gain } = sound;
    const now = audioContext.currentTime;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * audioSettings.sfxVolume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration);
}

/**
 * Spielt weißes Rauschen (für Explosionen, Schüsse)
 */
function playNoise(duration = 0.1, volume = 0.2, filterFreq = 1000) {
    if (!ensureAudioReady() || !audioSettings.enabled) return;
    if (!audioContext || !masterGain) return;

    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    gain.gain.setValueAtTime(volume * audioSettings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(now);
    noise.stop(now + duration);
}

// ===== WAFFEN-SOUNDS =====

/**
 * Schuss-Sound für Scout (leichtes Gewehr)
 */
export function playScoutShot() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Schneller, heller Schuss
    playNoise(0.08, 0.25, 3000);
    playTone(800, 'square', 0.05, 0.15);

    // Nachhall
    setTimeout(() => playNoise(0.1, 0.08, 1500), 50);
}

/**
 * Schuss-Sound für Assault (schweres Gewehr)
 */
export function playAssaultShot() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Tiefer, kraftvoller Schuss
    playNoise(0.15, 0.4, 800);
    playTone(150, 'sawtooth', 0.1, 0.3);
    playTone(100, 'square', 0.08, 0.2);

    // Nachhall
    setTimeout(() => playNoise(0.2, 0.15, 600), 80);
}

/**
 * Schuss-Sound für Sniper (präziser Schuss)
 */
export function playSniperShot() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Scharfer, durchdringender Schuss
    playNoise(0.05, 0.35, 4000);
    playTone(1200, 'sine', 0.03, 0.2);

    // Echo-Effekt
    setTimeout(() => {
        playNoise(0.15, 0.1, 2000);
        playTone(600, 'sine', 0.1, 0.05);
    }, 100);
    setTimeout(() => playNoise(0.2, 0.05, 1000), 250);
}

/**
 * Schuss-Sound für Medic (leichte Waffe)
 */
export function playMedicShot() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Leichter, schneller Schuss
    playNoise(0.06, 0.2, 2500);
    playTone(600, 'triangle', 0.04, 0.15);
}

/**
 * Angriffs-Sound für Ninja (Nahkampf)
 */
export function playNinjaAttack() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;
    if (!audioContext || !masterGain) return;

    // Schneller Schwung-Sound
    const now = audioContext.currentTime;

    // Schwung
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

    gain.gain.setValueAtTime(0.2 * audioSettings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.15);

    // Hit sound effect
    setTimeout(() => playNoise(0.05, 0.25, 500), 100);
}

/**
 * Play the appropriate weapon sound based on unit class
 */
export function playWeaponSound(unitClass) {
    switch (unitClass) {
        case 'scout':
            playScoutShot();
            break;
        case 'assault':
            playAssaultShot();
            break;
        case 'sniper':
            playSniperShot();
            break;
        case 'medic':
            playMedicShot();
            break;
        case 'commando':
            playNinjaAttack();
            break;
        default:
            playScoutShot();
    }
}

// ===== TREFFER-SOUNDS =====

/**
 * Treffer-Sound
 */
export function playHit() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playNoise(0.08, 0.3, 600);
    playTone(200, 'sine', 0.1, 0.2);
}

/**
 * Kritischer Treffer
 */
export function playCriticalHit() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Intensiverer Treffer
    playNoise(0.12, 0.4, 800);
    playTone(400, 'sawtooth', 0.08, 0.25);
    playTone(800, 'sine', 0.15, 0.15);

    // Extra Punch
    setTimeout(() => playTone(100, 'sine', 0.1, 0.3), 50);
}

/**
 * Verfehlt-Sound
 */
export function playMiss() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;
    if (!audioContext || !masterGain) return;

    // Vorbeizischen
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.2);

    gain.gain.setValueAtTime(0.15 * audioSettings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
}

/**
 * Einheit stirbt
 */
export function playDeath() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;
    if (!audioContext || !masterGain) return;

    // Fallender Ton
    const now = audioContext.currentTime;

    playNoise(0.2, 0.3, 400);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

    gain.gain.setValueAtTime(0.25 * audioSettings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.4);
}

/**
 * Schild blockiert
 */
export function playShieldBlock() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Metallisches Abprallen
    playTone(800, 'triangle', 0.1, 0.3);
    playTone(1200, 'sine', 0.15, 0.2);
    playNoise(0.05, 0.2, 3000);
}

// ===== SPECIAL ABILITY SOUNDS =====

/**
 * Healing sound effect
 */
export function playHeal() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Ascending, warm tone
    const now = audioContext.currentTime;

    [400, 500, 600, 800].forEach((freq, i) => {
        setTimeout(() => {
            playTone(freq, 'sine', 0.2, 0.15);
        }, i * 80);
    });
}

/**
 * Sprint activated sound effect
 */
export function playSprint() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;
    if (!audioContext || !masterGain) return;

    // Fast ascending tone
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

    gain.gain.setValueAtTime(0.15 * audioSettings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
}

/**
 * Powershot activated sound effect
 */
export function playPowershot() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Powerful charging sound
    playTone(150, 'sawtooth', 0.2, 0.25);
    playTone(300, 'square', 0.15, 0.15);
    playNoise(0.1, 0.15, 500);
}

/**
 * Cloak activated sound effect
 */
export function playCloak() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Mysterious, descending tone
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    gain.gain.setValueAtTime(0.2 * audioSettings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.35);

    // Echo
    setTimeout(() => playTone(400, 'sine', 0.2, 0.08), 150);
}

/**
 * Deckung genommen
 */
export function playCover() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Rascheln/Ducken
    playNoise(0.1, 0.2, 800);
    playTone(150, 'sine', 0.08, 0.15);
}

// ===== BEWEGUNGS-SOUNDS =====

/**
 * Schritt-Sound
 */
export function playFootstep() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Leiser Schritt
    playNoise(0.05, 0.1, 300 + Math.random() * 200);
}

/**
 * Bewegung starten
 */
export function playMoveStart() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(300, 'sine', 0.05, 0.1);
    playNoise(0.03, 0.1, 400);
}

/**
 * Bewegung beenden
 */
export function playMoveEnd() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(250, 'sine', 0.08, 0.12);
    playNoise(0.05, 0.12, 350);
}

// ===== UI-SOUNDS =====

/**
 * Button-Klick
 */
export function playClick() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(600, 'sine', 0.04, 0.15);
}

/**
 * Einheit auswählen
 */
export function playSelect() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(400, 'sine', 0.06, 0.12);
    setTimeout(() => playTone(600, 'sine', 0.06, 0.1), 50);
}

/**
 * Ziel auswählen
 */
export function playTarget() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(800, 'square', 0.03, 0.15);
    playTone(1000, 'square', 0.03, 0.1);
}

/**
 * Fehler/Ungültige Aktion
 */
export function playError() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(200, 'square', 0.1, 0.2);
    setTimeout(() => playTone(150, 'square', 0.15, 0.2), 100);
}

/**
 * Erfolg/Bestätigung
 */
export function playSuccess() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(400, 'sine', 0.08, 0.15);
    setTimeout(() => playTone(600, 'sine', 0.08, 0.15), 80);
    setTimeout(() => playTone(800, 'sine', 0.1, 0.12), 160);
}

/**
 * Level Up
 */
export function playLevelUp() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Triumphaler aufsteigender Ton
    const notes = [400, 500, 600, 800, 1000];
    notes.forEach((freq, i) => {
        setTimeout(() => {
            playTone(freq, 'sine', 0.15, 0.2);
            if (i === notes.length - 1) {
                playTone(freq * 1.5, 'triangle', 0.3, 0.1);
            }
        }, i * 100);
    });
}

/**
 * Power-Up aufsammeln
 */
export function playPowerup() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(600, 'sine', 0.1, 0.2);
    setTimeout(() => playTone(900, 'sine', 0.1, 0.18), 80);
    setTimeout(() => playTone(1200, 'triangle', 0.15, 0.15), 160);
}

// ===== SPIEL-SOUNDS =====

/**
 * Runde startet
 */
export function playRoundStart() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(300, 'sine', 0.1, 0.15);
    setTimeout(() => playTone(400, 'sine', 0.1, 0.15), 100);
    setTimeout(() => playTone(500, 'sine', 0.15, 0.2), 200);
}

/**
 * Zug beenden
 */
export function playTurnEnd() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(500, 'sine', 0.1, 0.15);
    setTimeout(() => playTone(400, 'sine', 0.1, 0.12), 100);
    setTimeout(() => playTone(300, 'sine', 0.15, 0.1), 200);
}

/**
 * Spiel gewonnen
 */
export function playVictory() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Fanfare
    const melody = [
        { freq: 400, delay: 0 },
        { freq: 500, delay: 150 },
        { freq: 600, delay: 300 },
        { freq: 800, delay: 500 },
        { freq: 800, delay: 700 },
        { freq: 1000, delay: 900 }
    ];

    melody.forEach(note => {
        setTimeout(() => {
            playTone(note.freq, 'sine', 0.2, 0.25);
            playTone(note.freq * 1.5, 'triangle', 0.15, 0.1);
        }, note.delay);
    });
}

/**
 * Spiel verloren
 */
export function playDefeat() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Trauriger absteigender Ton
    const melody = [
        { freq: 400, delay: 0 },
        { freq: 350, delay: 200 },
        { freq: 300, delay: 400 },
        { freq: 200, delay: 600 }
    ];

    melody.forEach(note => {
        setTimeout(() => {
            playTone(note.freq, 'sine', 0.3, 0.2);
        }, note.delay);
    });
}

// ===== EVENT-SOUNDS =====

/**
 * Ereignis-Sound (allgemein)
 */
export function playEvent() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    playTone(600, 'triangle', 0.1, 0.2);
    setTimeout(() => playTone(800, 'triangle', 0.1, 0.18), 100);
    setTimeout(() => playTone(600, 'triangle', 0.15, 0.15), 200);
}

/**
 * Sturm-Ereignis
 */
export function playStorm() {
    if (!ensureAudioReady() || !audioSettings.enabled) return;

    // Thunder-like sound
    playNoise(0.5, 0.3, 200);
    playTone(80, 'sawtooth', 0.4, 0.2);

    setTimeout(() => {
        playNoise(0.3, 0.2, 150);
    }, 200);
}

// ===== AMBIENT SOUNDS =====

/**
 * Start ambient sound loop
 */
export function startAmbient() {
    if (!audioContext || !audioSettings.enabled || ambientSource) return;

    // Create gentle wind noise
    const bufferSize = audioContext.sampleRate * 2; // 2 second loop
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Filtered noise for wind effect
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise (smoother)
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
    }

    ambientSource = audioContext.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    ambientGain = audioContext.createGain();
    ambientGain.gain.value = audioSettings.ambientVolume * audioSettings.masterVolume;

    ambientSource.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(audioContext.destination);

    ambientSource.start();
}

/**
 * Stoppt Ambient-Sound
 */
export function stopAmbient() {
    if (ambientSource) {
        ambientSource.stop();
        ambientSource = null;
        ambientGain = null;
    }
}

/**
 * Setzt Ambient-Lautstärke
 */
export function setAmbientVolume(value) {
    audioSettings.ambientVolume = Math.max(0, Math.min(1, value));
    if (ambientGain) {
        ambientGain.gain.value = audioSettings.ambientVolume * audioSettings.masterVolume;
    }
}
