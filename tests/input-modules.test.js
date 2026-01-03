import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
    store: {},
    getItem: vi.fn((key) => localStorageMock.store[key] || null),
    setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
    removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
    clear: vi.fn(() => { localStorageMock.store = {}; })
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock document
const mockOverlay = {
    id: 'tactical-explanation-overlay',
    className: '',
    innerHTML: '',
    style: { display: 'none' }
};
vi.stubGlobal('document', {
    getElementById: vi.fn((id) => {
        if (id === 'tactical-explanation-overlay') return mockOverlay;
        return null;
    }),
    createElement: vi.fn(() => mockOverlay),
    body: { appendChild: vi.fn() }
});

import {
    FIRST_USE_EXPLANATIONS,
    showFirstUseExplanation,
    hasSeenExplanation,
    resetExplanations
} from '../js/input/explanations.js';

import {
    getDragState,
    getIsDragging,
    getHasDragged,
    getLastTapTime,
    setLastTapTime,
    resetDragState,
    getPinchDistance,
    getPinchCenter
} from '../js/input/handlers.js';

describe('Input Explanations Module', () => {
    beforeEach(() => {
        resetExplanations();
        localStorageMock.clear();
        mockOverlay.style.display = 'none';
        mockOverlay.innerHTML = '';
    });

    describe('FIRST_USE_EXPLANATIONS', () => {
        it('should have explanations for all tactical features', () => {
            expect(FIRST_USE_EXPLANATIONS.overwatch).toBeDefined();
            expect(FIRST_USE_EXPLANATIONS.ambush).toBeDefined();
            expect(FIRST_USE_EXPLANATIONS.suppress).toBeDefined();
            expect(FIRST_USE_EXPLANATIONS.coordinate).toBeDefined();
        });

        it('should have title and message for each explanation', () => {
            for (const [key, explanation] of Object.entries(FIRST_USE_EXPLANATIONS)) {
                expect(explanation.title).toBeDefined();
                expect(explanation.message).toBeDefined();
                expect(typeof explanation.title).toBe('string');
                expect(typeof explanation.message).toBe('string');
            }
        });

        it('should have German text in explanations', () => {
            // Check for German keywords
            expect(FIRST_USE_EXPLANATIONS.overwatch.title).toContain('Deckungsfeuer');
            expect(FIRST_USE_EXPLANATIONS.ambush.title).toContain('Hinterhalt');
            expect(FIRST_USE_EXPLANATIONS.suppress.title).toContain('Unterdrückungsfeuer');
            expect(FIRST_USE_EXPLANATIONS.coordinate.title).toContain('Koordinierter Angriff');
        });
    });

    describe('showFirstUseExplanation', () => {
        it('should return true when showing explanation first time', () => {
            const result = showFirstUseExplanation('overwatch');
            expect(result).toBe(true);
        });

        it('should return false when showing same explanation again', () => {
            showFirstUseExplanation('overwatch');
            const result = showFirstUseExplanation('overwatch');
            expect(result).toBe(false);
        });

        it('should return false for unknown feature', () => {
            const result = showFirstUseExplanation('unknown_feature');
            expect(result).toBe(false);
        });

        it('should show different explanations independently', () => {
            expect(showFirstUseExplanation('overwatch')).toBe(true);
            expect(showFirstUseExplanation('ambush')).toBe(true);
            expect(showFirstUseExplanation('suppress')).toBe(true);
            expect(showFirstUseExplanation('coordinate')).toBe(true);
        });

        it('should display overlay when showing explanation', () => {
            showFirstUseExplanation('overwatch');
            expect(mockOverlay.style.display).toBe('flex');
        });
    });

    describe('hasSeenExplanation', () => {
        it('should return false for unseen explanation', () => {
            expect(hasSeenExplanation('overwatch')).toBe(false);
        });

        it('should return true after explanation shown', () => {
            showFirstUseExplanation('overwatch');
            expect(hasSeenExplanation('overwatch')).toBe(true);
        });
    });

    describe('resetExplanations', () => {
        it('should reset all seen explanations', () => {
            showFirstUseExplanation('overwatch');
            showFirstUseExplanation('ambush');

            expect(hasSeenExplanation('overwatch')).toBe(true);
            expect(hasSeenExplanation('ambush')).toBe(true);

            resetExplanations();

            expect(hasSeenExplanation('overwatch')).toBe(false);
            expect(hasSeenExplanation('ambush')).toBe(false);
        });
    });
});

describe('Input Handlers Module', () => {
    describe('getDragState', () => {
        beforeEach(() => {
            resetDragState();
        });

        it('should return drag state object', () => {
            const state = getDragState();
            expect(state).toHaveProperty('isDragging');
            expect(state).toHaveProperty('hasDragged');
            expect(state).toHaveProperty('dragDistance');
            expect(state).toHaveProperty('lastTapTime');
        });

        it('should have initial values after reset', () => {
            resetDragState();
            expect(getIsDragging()).toBe(false);
            expect(getHasDragged()).toBe(false);
        });
    });

    describe('getIsDragging', () => {
        beforeEach(() => {
            resetDragState();
        });

        it('should return false initially', () => {
            expect(getIsDragging()).toBe(false);
        });
    });

    describe('getHasDragged', () => {
        beforeEach(() => {
            resetDragState();
        });

        it('should return false initially', () => {
            expect(getHasDragged()).toBe(false);
        });
    });

    describe('lastTapTime', () => {
        it('should be settable and gettable', () => {
            const now = Date.now();
            setLastTapTime(now);
            expect(getLastTapTime()).toBe(now);
        });

        it('should start at 0', () => {
            setLastTapTime(0);
            expect(getLastTapTime()).toBe(0);
        });
    });

    describe('getPinchDistance', () => {
        it('should calculate distance between two touch points', () => {
            const touches = [
                { clientX: 0, clientY: 0 },
                { clientX: 3, clientY: 4 }
            ];
            // Distance should be 5 (3-4-5 triangle)
            expect(getPinchDistance(touches)).toBe(5);
        });

        it('should return 0 for same point', () => {
            const touches = [
                { clientX: 100, clientY: 100 },
                { clientX: 100, clientY: 100 }
            ];
            expect(getPinchDistance(touches)).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const touches = [
                { clientX: -10, clientY: -10 },
                { clientX: -13, clientY: -6 }
            ];
            // Distance = sqrt(9 + 16) = 5
            expect(getPinchDistance(touches)).toBe(5);
        });
    });

    describe('getPinchCenter', () => {
        it('should calculate center between two touch points', () => {
            const touches = [
                { clientX: 0, clientY: 0 },
                { clientX: 100, clientY: 100 }
            ];
            const center = getPinchCenter(touches);
            expect(center.x).toBe(50);
            expect(center.y).toBe(50);
        });

        it('should handle same point', () => {
            const touches = [
                { clientX: 50, clientY: 75 },
                { clientX: 50, clientY: 75 }
            ];
            const center = getPinchCenter(touches);
            expect(center.x).toBe(50);
            expect(center.y).toBe(75);
        });

        it('should handle negative coordinates', () => {
            const touches = [
                { clientX: -100, clientY: -50 },
                { clientX: 100, clientY: 50 }
            ];
            const center = getPinchCenter(touches);
            expect(center.x).toBe(0);
            expect(center.y).toBe(0);
        });
    });
});
