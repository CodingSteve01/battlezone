// ===== INPUT MODULE INDEX =====
// Re-exports camera and other input functionality

export {
    initCamera,
    getUnitTilePosition,
    updateCameraOffset,
    limitCameraBounds,
    applyZoom,
    calculateSituationalZoom,
    getRelevantUnitsForZoom,
    scrollToPosition,
    scrollToUnit,
    followUnitInstant,
    scrollToUnitWithZoom,
    centerOnTeam
} from './camera.js';
