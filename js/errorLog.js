// ===== IN-GAME ERROR LOG SYSTEM =====
// Captures console errors, warnings, and game events for mobile debugging

const MAX_LOG_ENTRIES = 100;
const errorLog = {
    entries: [],
    listeners: []
};

// Log levels with German labels
const LOG_LEVELS = {
    error: { icon: '❌', label: 'Fehler', color: '#ef4444' },
    warn: { icon: '⚠️', label: 'Warnung', color: '#f59e0b' },
    info: { icon: 'ℹ️', label: 'Info', color: '#3b82f6' },
    debug: { icon: '🔍', label: 'Debug', color: '#6b7280' },
    render: { icon: '🖼️', label: 'Render', color: '#8b5cf6' },
    ai: { icon: '🤖', label: 'KI', color: '#10b981' }
};

/**
 * Add a log entry
 */
export function logEntry(level, message, details = null) {
    const entry = {
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString('de-DE'),
        level,
        message: String(message),
        details: details ? String(details) : null,
        stack: level === 'error' && details instanceof Error ? details.stack : null
    };

    errorLog.entries.push(entry);

    // Trim to max entries
    if (errorLog.entries.length > MAX_LOG_ENTRIES) {
        errorLog.entries.shift();
    }

    // Notify listeners
    errorLog.listeners.forEach(fn => {
        try {
            fn(entry);
        } catch (_e) {
            // Ignore listener errors
        }
    });
}

/**
 * Log an error
 */
export function logError(message, error = null) {
    logEntry('error', message, error);
}

/**
 * Log a warning
 */
export function logWarn(message, details = null) {
    logEntry('warn', message, details);
}

/**
 * Log info
 */
export function logInfo(message, details = null) {
    logEntry('info', message, details);
}

/**
 * Log debug info
 */
export function logDebug(message, details = null) {
    logEntry('debug', message, details);
}

/**
 * Log render-related events
 */
export function logRender(message, details = null) {
    logEntry('render', message, details);
}

/**
 * Log AI-related events
 */
export function logAI(message, details = null) {
    logEntry('ai', message, details);
}

/**
 * Get all log entries
 */
export function getLogEntries() {
    return [...errorLog.entries];
}

/**
 * Clear all log entries
 */
export function clearLog() {
    errorLog.entries = [];
    errorLog.listeners.forEach(fn => {
        try {
            fn(null); // Signal clear
        } catch (_e) {
            // Ignore
        }
    });
}

/**
 * Add a listener for new log entries
 */
export function addLogListener(fn) {
    errorLog.listeners.push(fn);
    return () => {
        errorLog.listeners = errorLog.listeners.filter(l => l !== fn);
    };
}

/**
 * Get error count
 */
export function getErrorCount() {
    return errorLog.entries.filter(e => e.level === 'error').length;
}

/**
 * Get warning count
 */
export function getWarnCount() {
    return errorLog.entries.filter(e => e.level === 'warn').length;
}

/**
 * Format log entries as text for copying
 */
export function formatLogAsText() {
    return errorLog.entries.map(entry => {
        const level = LOG_LEVELS[entry.level];
        let text = `[${entry.time}] ${level.label}: ${entry.message}`;
        if (entry.details) {
            text += `\n  Details: ${entry.details}`;
        }
        if (entry.stack) {
            text += `\n  Stack: ${entry.stack}`;
        }
        return text;
    }).join('\n\n');
}

/**
 * Initialize console interception
 * Captures console.error and console.warn calls
 */
export function initErrorCapture() {
    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;

    // Override console.error
    console.error = function(...args) {
        // Call original first
        originalError.apply(console, args);

        // Log to our system
        const message = args.map(arg => {
            if (arg instanceof Error) {
                return arg.message;
            }
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        const error = args.find(a => a instanceof Error);
        logEntry('error', message, error);
    };

    // Override console.warn
    console.warn = function(...args) {
        // Call original first
        originalWarn.apply(console, args);

        // Log to our system
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        logEntry('warn', message);
    };

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
        logEntry('error', `Unhandled: ${event.message}`, event.error);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
        logEntry('error', `Promise rejected: ${reason}`, event.reason);
    });

    logEntry('info', 'Error-Logging aktiviert');
}

/**
 * Create and show the log viewer modal
 */
export function showLogViewer() {
    // Remove existing viewer
    const existing = document.getElementById('error-log-viewer');
    if (existing) existing.remove();

    const viewer = document.createElement('div');
    viewer.id = 'error-log-viewer';
    viewer.className = 'error-log-viewer';

    const entries = getLogEntries();
    const errorCount = getErrorCount();
    const warnCount = getWarnCount();

    viewer.innerHTML = `
        <div class="log-viewer-header">
            <h3>📋 Debug-Log</h3>
            <div class="log-stats">
                <span class="log-stat error">${errorCount} Fehler</span>
                <span class="log-stat warn">${warnCount} Warnungen</span>
                <span class="log-stat total">${entries.length} Einträge</span>
            </div>
            <button class="log-close-btn" id="log-close-btn">✕</button>
        </div>
        <div class="log-viewer-content" id="log-content">
            ${entries.length === 0 ?
                '<div class="log-empty">Keine Log-Einträge vorhanden</div>' :
                entries.map(entry => {
                    const level = LOG_LEVELS[entry.level] || LOG_LEVELS.debug;
                    return `
                        <div class="log-entry ${entry.level}">
                            <span class="log-time">${entry.time}</span>
                            <span class="log-icon">${level.icon}</span>
                            <span class="log-message">${escapeHtml(entry.message)}</span>
                            ${entry.details ? `<div class="log-details">${escapeHtml(entry.details)}</div>` : ''}
                            ${entry.stack ? `<div class="log-stack">${escapeHtml(entry.stack)}</div>` : ''}
                        </div>
                    `;
                }).reverse().join('')
            }
        </div>
        <div class="log-viewer-footer">
            <button class="log-btn" id="log-copy-btn">📋 Kopieren</button>
            <button class="log-btn danger" id="log-clear-btn">🗑️ Leeren</button>
        </div>
    `;

    document.body.appendChild(viewer);

    // Scroll to bottom (most recent first due to reverse)
    const content = document.getElementById('log-content');
    if (content) content.scrollTop = 0;

    // Add event listeners
    document.getElementById('log-close-btn').onclick = hideLogViewer;

    document.getElementById('log-copy-btn').onclick = () => {
        const text = formatLogAsText();
        navigator.clipboard.writeText(text).then(() => {
            logInfo('Log in Zwischenablage kopiert');
            const btn = document.getElementById('log-copy-btn');
            if (btn) {
                btn.textContent = '✓ Kopiert!';
                setTimeout(() => {
                    btn.textContent = '📋 Kopieren';
                }, 2000);
            }
        }).catch(err => {
            logError('Kopieren fehlgeschlagen', err);
        });
    };

    document.getElementById('log-clear-btn').onclick = () => {
        clearLog();
        const content = document.getElementById('log-content');
        if (content) {
            content.innerHTML = '<div class="log-empty">Log wurde geleert</div>';
        }
        // Update stats
        const stats = viewer.querySelector('.log-stats');
        if (stats) {
            stats.innerHTML = `
                <span class="log-stat error">0 Fehler</span>
                <span class="log-stat warn">0 Warnungen</span>
                <span class="log-stat total">0 Einträge</span>
            `;
        }
    };

    // Animate in
    requestAnimationFrame(() => {
        viewer.classList.add('visible');
    });
}

/**
 * Hide the log viewer
 */
export function hideLogViewer() {
    const viewer = document.getElementById('error-log-viewer');
    if (viewer) {
        viewer.classList.remove('visible');
        setTimeout(() => viewer.remove(), 300);
    }
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export LOG_LEVELS for external use
export { LOG_LEVELS };
