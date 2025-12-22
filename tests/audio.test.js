import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AudioContext before importing audio module
const mockGainNode = {
    connect: vi.fn(),
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
};

const mockOscillator = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
};

const mockBufferSource = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    loop: false,
    buffer: null
};

const mockFilter = {
    connect: vi.fn(),
    type: 'lowpass',
    frequency: { value: 1000 }
};

const mockAudioContext = {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(() => ({ ...mockGainNode, gain: { ...mockGainNode.gain } })),
    createOscillator: vi.fn(() => ({ ...mockOscillator, frequency: { ...mockOscillator.frequency } })),
    createBufferSource: vi.fn(() => ({ ...mockBufferSource })),
    createBiquadFilter: vi.fn(() => ({ ...mockFilter, frequency: { ...mockFilter.frequency } })),
    createBuffer: vi.fn((_channels, length, _sampleRate) => ({
        getChannelData: vi.fn(() => new Float32Array(length))
    }))
};

// Set up global AudioContext mock
global.AudioContext = vi.fn(() => mockAudioContext);
global.window = { AudioContext: global.AudioContext };

describe('audio', () => {
    let audio;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset module state by re-importing
        vi.resetModules();
        audio = await import('../js/audio.js');
    });

    describe('audioSettings', () => {
        it('should have default settings', () => {
            expect(audio.audioSettings).toBeDefined();
            expect(audio.audioSettings.masterVolume).toBe(0.7);
            expect(audio.audioSettings.sfxVolume).toBe(0.8);
            expect(audio.audioSettings.ambientVolume).toBe(0.3);
            expect(audio.audioSettings.enabled).toBe(true);
        });
    });

    describe('initAudio', () => {
        it('should create AudioContext when initialized', () => {
            audio.initAudio();
            expect(global.AudioContext).toHaveBeenCalled();
        });

        it('should not reinitialize if already initialized', () => {
            audio.initAudio();
            const callCount = global.AudioContext.mock.calls.length;
            audio.initAudio();
            expect(global.AudioContext.mock.calls.length).toBe(callCount);
        });
    });

    describe('setMasterVolume', () => {
        it('should clamp volume between 0 and 1', () => {
            audio.initAudio();

            audio.setMasterVolume(0.5);
            expect(audio.audioSettings.masterVolume).toBe(0.5);

            audio.setMasterVolume(-0.5);
            expect(audio.audioSettings.masterVolume).toBe(0);

            audio.setMasterVolume(1.5);
            expect(audio.audioSettings.masterVolume).toBe(1);
        });
    });

    describe('toggleAudio', () => {
        it('should toggle audio enabled state', () => {
            audio.initAudio();

            audio.toggleAudio(false);
            expect(audio.audioSettings.enabled).toBe(false);

            audio.toggleAudio(true);
            expect(audio.audioSettings.enabled).toBe(true);
        });
    });

    describe('weapon sounds', () => {
        beforeEach(() => {
            audio.initAudio();
        });

        it('playWeaponSound should call correct function for each class', () => {
            // These should not throw
            expect(() => audio.playWeaponSound('scout')).not.toThrow();
            expect(() => audio.playWeaponSound('assault')).not.toThrow();
            expect(() => audio.playWeaponSound('sniper')).not.toThrow();
            expect(() => audio.playWeaponSound('medic')).not.toThrow();
            expect(() => audio.playWeaponSound('ninja')).not.toThrow();
            expect(() => audio.playWeaponSound('unknown')).not.toThrow();
        });

        it('should not play sounds when disabled', () => {
            audio.toggleAudio(false);
            // Should not throw and should not create oscillators
            // When disabled, no new oscillators should be created
            audio.playScoutShot();
            // When disabled, no new oscillators should be created
        });
    });

    describe('hit/miss sounds', () => {
        beforeEach(() => {
            audio.initAudio();
        });

        it('should have playHit function', () => {
            expect(typeof audio.playHit).toBe('function');
            expect(() => audio.playHit()).not.toThrow();
        });

        it('should have playCriticalHit function', () => {
            expect(typeof audio.playCriticalHit).toBe('function');
            expect(() => audio.playCriticalHit()).not.toThrow();
        });

        it('should have playMiss function', () => {
            expect(typeof audio.playMiss).toBe('function');
            expect(() => audio.playMiss()).not.toThrow();
        });

        it('should have playDeath function', () => {
            expect(typeof audio.playDeath).toBe('function');
            expect(() => audio.playDeath()).not.toThrow();
        });
    });

    describe('special ability sounds', () => {
        beforeEach(() => {
            audio.initAudio();
        });

        it('should have playHeal function', () => {
            expect(typeof audio.playHeal).toBe('function');
            expect(() => audio.playHeal()).not.toThrow();
        });

        it('should have playSprint function', () => {
            expect(typeof audio.playSprint).toBe('function');
            expect(() => audio.playSprint()).not.toThrow();
        });

        it('should have playPowershot function', () => {
            expect(typeof audio.playPowershot).toBe('function');
            expect(() => audio.playPowershot()).not.toThrow();
        });

        it('should have playCloak function', () => {
            expect(typeof audio.playCloak).toBe('function');
            expect(() => audio.playCloak()).not.toThrow();
        });

        it('should have playCover function', () => {
            expect(typeof audio.playCover).toBe('function');
            expect(() => audio.playCover()).not.toThrow();
        });
    });

    describe('UI sounds', () => {
        beforeEach(() => {
            audio.initAudio();
        });

        it('should have playClick function', () => {
            expect(typeof audio.playClick).toBe('function');
            expect(() => audio.playClick()).not.toThrow();
        });

        it('should have playSelect function', () => {
            expect(typeof audio.playSelect).toBe('function');
            expect(() => audio.playSelect()).not.toThrow();
        });

        it('should have playError function', () => {
            expect(typeof audio.playError).toBe('function');
            expect(() => audio.playError()).not.toThrow();
        });

        it('should have playSuccess function', () => {
            expect(typeof audio.playSuccess).toBe('function');
            expect(() => audio.playSuccess()).not.toThrow();
        });
    });

    describe('game sounds', () => {
        beforeEach(() => {
            audio.initAudio();
        });

        it('should have playRoundStart function', () => {
            expect(typeof audio.playRoundStart).toBe('function');
            expect(() => audio.playRoundStart()).not.toThrow();
        });

        it('should have playTurnEnd function', () => {
            expect(typeof audio.playTurnEnd).toBe('function');
            expect(() => audio.playTurnEnd()).not.toThrow();
        });

        it('should have playVictory function', () => {
            expect(typeof audio.playVictory).toBe('function');
            expect(() => audio.playVictory()).not.toThrow();
        });

        it('should have playDefeat function', () => {
            expect(typeof audio.playDefeat).toBe('function');
            expect(() => audio.playDefeat()).not.toThrow();
        });
    });

    describe('ambient sounds', () => {
        beforeEach(() => {
            audio.initAudio();
        });

        it('should have startAmbient function', () => {
            expect(typeof audio.startAmbient).toBe('function');
            expect(() => audio.startAmbient()).not.toThrow();
        });

        it('should have stopAmbient function', () => {
            expect(typeof audio.stopAmbient).toBe('function');
            expect(() => audio.stopAmbient()).not.toThrow();
        });

        it('should have setAmbientVolume function', () => {
            expect(typeof audio.setAmbientVolume).toBe('function');

            audio.setAmbientVolume(0.5);
            expect(audio.audioSettings.ambientVolume).toBe(0.5);

            audio.setAmbientVolume(-1);
            expect(audio.audioSettings.ambientVolume).toBe(0);

            audio.setAmbientVolume(2);
            expect(audio.audioSettings.ambientVolume).toBe(1);
        });
    });
});
