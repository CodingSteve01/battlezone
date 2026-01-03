// ===== INPUT MODULE INDEX =====
// Re-exports all input-related functionality from submodules

// Camera control functions
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

// First-use explanations
export {
    FIRST_USE_EXPLANATIONS,
    showFirstUseExplanation,
    hasSeenExplanation,
    resetExplanations
} from './explanations.js';

// Event handlers
export {
    initHandlers,
    getCanvas,
    pixelToHexWithHeight,
    getDragState,
    getIsDragging,
    getHasDragged,
    getLastTapTime,
    setLastTapTime,
    resetDragState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    getPinchDistance,
    getPinchCenter,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel
} from './handlers.js';

// Path queue management
export {
    continueQueuedPath,
    executeQueuedPathsForPlayer,
    executeQueuedPathForUnit,
    cancelAllQueuedPaths,
    getQueuedPathCount,
    updateWaypointUI
} from './pathQueue.js';
