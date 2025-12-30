/**
 * Shadow Squad Asset Generator - Main App
 */

// Storage for generated assets
const generatedAssets = {
    terrain: [],
    trees: [],
    shorelines: [],
    bushes: [],
    characters: []
};

// ============================================
// WHITESPACE CROPPING UTILITIES
// ============================================

/**
 * Analyze a canvas to find the bounding box of non-transparent content
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {number} alphaThreshold - Minimum alpha value to consider as content (0-255)
 * @returns {Object} { left, top, right, bottom, width, height, isEmpty }
 */
function findContentBounds(canvas, alphaThreshold = 1) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha >= alphaThreshold) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    const isEmpty = minX > maxX || minY > maxY;

    return {
        left: isEmpty ? 0 : minX,
        top: isEmpty ? 0 : minY,
        right: isEmpty ? canvas.width : maxX + 1,
        bottom: isEmpty ? canvas.height : maxY + 1,
        width: isEmpty ? canvas.width : maxX - minX + 1,
        height: isEmpty ? canvas.height : maxY - minY + 1,
        isEmpty
    };
}

/**
 * Crop whitespace from a canvas and calculate anchor point
 * The anchor point is the x-center at the bottom y position (where object touches ground)
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas to crop
 * @param {number} padding - Optional padding to add around content
 * @returns {Object} { canvas, anchor, originalSize, croppedSize, bounds }
 */
function cropWhitespace(sourceCanvas, padding = 2) {
    const bounds = findContentBounds(sourceCanvas);

    if (bounds.isEmpty) {
        return {
            canvas: sourceCanvas,
            anchor: { x: 0.5, y: 1.0 }, // Normalized anchor (center-bottom)
            originalSize: { width: sourceCanvas.width, height: sourceCanvas.height },
            croppedSize: { width: sourceCanvas.width, height: sourceCanvas.height },
            bounds: { left: 0, top: 0, right: sourceCanvas.width, bottom: sourceCanvas.height },
            cropped: false
        };
    }

    // Calculate new dimensions with padding
    const newWidth = bounds.width + padding * 2;
    const newHeight = bounds.height + padding * 2;

    // Create cropped canvas
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = newWidth;
    croppedCanvas.height = newHeight;
    const ctx = croppedCanvas.getContext('2d');

    // Copy the cropped region
    ctx.drawImage(
        sourceCanvas,
        bounds.left, bounds.top, bounds.width, bounds.height,
        padding, padding, bounds.width, bounds.height
    );

    // Calculate anchor point (normalized 0-1 range):
    // - X: center of the original content relative to the cropped canvas
    // - Y: bottom of the content (where it touches the ground)
    const originalCenterX = (bounds.left + bounds.right) / 2;
    const anchorXPixels = (originalCenterX - bounds.left + padding);
    const anchorX = anchorXPixels / newWidth;
    const anchorY = 1.0; // Always bottom for ground placement

    return {
        canvas: croppedCanvas,
        anchor: {
            x: anchorX,
            y: anchorY
        },
        originalSize: { width: sourceCanvas.width, height: sourceCanvas.height },
        croppedSize: { width: newWidth, height: newHeight },
        bounds: bounds,
        cropped: true
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSettings() {
    return {
        variants: parseInt(document.getElementById('variants').value, 10) || 4,
        terrainSize: parseInt(document.getElementById('terrainSize').value, 10) || 256,
        charSize: parseInt(document.getElementById('charSize').value, 10) || 256
    };
}

function getSelectedTypes(containerId) {
    const container = document.getElementById(containerId);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function updateProgress(percent) {
    document.getElementById('progress').style.width = percent + '%';
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

function addPreviewItem(container, canvas, label) {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.appendChild(canvas);
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
    labelDiv.textContent = label;
    div.appendChild(labelDiv);
    container.appendChild(div);
}

// Terrain generation
async function generateTerrain() {
    const settings = getSettings();
    // Combine regular terrain types with stream and path types
    const terrainTypes = getSelectedTypes('terrainTypes');
    const streamTypes = getSelectedTypes('streamTypes');
    const pathTypes = getSelectedTypes('pathTypes');
    const types = [...terrainTypes, ...streamTypes, ...pathTypes];

    const preview = document.getElementById('terrainPreview');
    preview.innerHTML = '';
    generatedAssets.terrain = [];

    // For flat-top hex: width = 2*r, height = sqrt(3)*r
    // So height/width = sqrt(3)/2 ≈ 0.866
    const hexHeight = Math.round(settings.terrainSize * Math.sqrt(3) / 2);
    const earthLayerHeight = Math.round(settings.terrainSize * 0.18);  // ~18% of tile width for earth layer
    const total = types.length * settings.variants;
    let count = 0;

    updateStatus('Generating isometric terrain textures with earth layers...');

    for (const type of types) {
        for (let v = 0; v < settings.variants; v++) {
            // Use generateIsometric for 2.5D tiles with earth layer and grass overhang
            const canvas = TerrainGenerator.generateIsometric(type, v, settings.terrainSize, hexHeight, earthLayerHeight);
            const label = `${type}_v${v}`;

            addPreviewItem(preview, canvas, label);
            generatedAssets.terrain.push({ canvas, label, type, variant: v });

            count++;
            updateProgress((count / total) * 100);
            await new Promise(r => setTimeout(r, 10)); // Allow UI update
        }
    }

    updateStatus(`Generated ${count} terrain textures`);
    showTab('terrain');
}

// Tree generation
async function generateTrees() {
    const settings = getSettings();
    const types = getSelectedTypes('treeTypes');
    const preview = document.getElementById('treesPreview');
    preview.innerHTML = '';
    generatedAssets.trees = [];

    const total = types.length * settings.variants;
    let count = 0;

    updateStatus('Generating tree sprites...');

    for (const type of types) {
        for (let v = 0; v < settings.variants; v++) {
            const canvas = TreeGenerator.generate(type, v, 256, 380);
            const label = `tree_${type}_${v}`;

            addPreviewItem(preview, canvas, label);
            generatedAssets.trees.push({ canvas, label, type, variant: v });

            count++;
            updateProgress((count / total) * 100);
            await new Promise(r => setTimeout(r, 10));
        }
    }

    updateStatus(`Generated ${count} tree sprites`);
    showTab('trees');
}

// Bush generation
async function generateBushes() {
    const settings = getSettings();
    const preview = document.getElementById('bushesPreview');
    preview.innerHTML = '';
    generatedAssets.bushes = [];

    const bushTypes = ['round', 'wild', 'flowering', 'berry', 'fern'];
    const grassTypes = ['short', 'tall', 'wheat', 'reed'];

    const total = (bushTypes.length + grassTypes.length) * settings.variants;
    let count = 0;

    updateStatus('Generating vegetation sprites...');

    // Bushes
    for (const type of bushTypes) {
        for (let v = 0; v < settings.variants; v++) {
            const canvas = BushGenerator.generate(type, v, 307, 300);
            const label = `bush_${type}_${v}`;

            addPreviewItem(preview, canvas, label);
            generatedAssets.bushes.push({ canvas, label, type: 'bush', subtype: type, variant: v });

            count++;
            updateProgress((count / total) * 100);
            await new Promise(r => setTimeout(r, 10));
        }
    }

    // Grass
    for (const type of grassTypes) {
        for (let v = 0; v < settings.variants; v++) {
            const canvas = GrassGenerator.generate(type, v, 307, 344);
            const label = `grass_${type}_${v}`;

            addPreviewItem(preview, canvas, label);
            generatedAssets.bushes.push({ canvas, label, type: 'grass', subtype: type, variant: v });

            count++;
            updateProgress((count / total) * 100);
            await new Promise(r => setTimeout(r, 10));
        }
    }

    updateStatus(`Generated ${count} vegetation sprites`);
    showTab('bushes');
}

// Character generation
async function generateCharacters() {
    const settings = getSettings();
    const preview = document.getElementById('charactersPreview');
    preview.innerHTML = '';
    generatedAssets.characters = [];

    const classes = ['scout', 'assault', 'medic', 'sniper', 'commando', 'elitesoldat'];
    const poses = ['normal', 'cover', 'attack', 'dead'];
    const players = 4;

    const total = classes.length * poses.length * players;
    let count = 0;

    updateStatus('Generating character sprites...');

    for (const cls of classes) {
        for (const pose of poses) {
            for (let p = 0; p < players; p++) {
                const canvas = CharacterGenerator.generate(cls, pose, p, settings.charSize, settings.charSize);
                const label = `${cls}_${pose}_p${p}`;

                addPreviewItem(preview, canvas, label);
                generatedAssets.characters.push({ canvas, label, unitClass: cls, state: pose, player: p });

                count++;
                updateProgress((count / total) * 100);
                await new Promise(r => setTimeout(r, 10));
            }
        }
    }

    updateStatus(`Generated ${count} character sprites`);
    showTab('characters');
}

// Shoreline generation
async function generateShorelines() {
    const settings = getSettings();
    const preview = document.getElementById('shorelinesPreview');
    preview.innerHTML = '';
    generatedAssets.shorelines = [];

    const hexHeight = Math.round(settings.terrainSize * Math.sqrt(3) / 2);
    const subtypes = ['water', 'swamp'];
    const directions = [0, 1, 2, 3, 4, 5];
    const total = subtypes.length * directions.length * settings.variants;
    let count = 0;

    updateStatus('Generating shoreline overlays...');

    for (const subtype of subtypes) {
        for (const direction of directions) {
            for (let v = 0; v < settings.variants; v++) {
                const canvas = ShorelineGenerator.generate(subtype, direction, v, settings.terrainSize, hexHeight);
                const label = `shore_${subtype}_${direction}_v${v}`;

                addPreviewItem(preview, canvas, label);
                generatedAssets.shorelines.push({
                    canvas,
                    label,
                    detailType: `shore_${subtype}_${direction}`,
                    variant: v
                });

                count++;
                updateProgress((count / total) * 100);
                await new Promise(r => setTimeout(r, 10));
            }
        }
    }

    updateStatus(`Generated ${count} shoreline overlays`);
    showTab('shorelines');
}

// Generate all
async function generateAll() {
    updateStatus('Generating all assets...');
    updateProgress(0);

    await generateTerrain();
    updateProgress(20);

    await generateTrees();
    updateProgress(40);

    await generateShorelines();
    updateProgress(60);

    await generateBushes();
    updateProgress(80);

    await generateCharacters();
    updateProgress(100);

    // Create sprite sheets
    await createSpriteSheets();

    updateStatus('All assets generated!');
}

// Create sprite sheets
async function createSpriteSheets() {
    const preview = document.getElementById('sheetsPreview');
    preview.innerHTML = '';

    updateStatus('Creating sprite sheets...');

    // Terrain sprite sheet (isometric tiles with earth layer)
    if (generatedAssets.terrain.length > 0) {
        const settings = getSettings();
        const hexHeight = Math.round(settings.terrainSize * Math.sqrt(3) / 2);
        const earthLayerHeight = Math.round(settings.terrainSize * 0.18);
        const totalHeight = hexHeight + earthLayerHeight;
        const sheet = createTerrainSpriteSheet(generatedAssets.terrain, settings.variants, settings.terrainSize, totalHeight, hexHeight, earthLayerHeight);
        addSheetPreview(preview, sheet.canvas, 'terrain-hexes.png', sheet.json);
    }

    // Trees sprite sheet (WITH cropping and anchor points)
    if (generatedAssets.trees.length > 0) {
        const sheet = createCroppedSpriteSheet(generatedAssets.trees, getSettings().variants);
        addSheetPreview(preview, sheet.canvas, 'trees.png', sheet.json);
    }

    // Shoreline overlays (fixed size, no cropping)
    if (generatedAssets.shorelines.length > 0) {
        const settings = getSettings();
        const hexHeight = Math.round(settings.terrainSize * Math.sqrt(3) / 2);
        const sheet = createSpriteSheet(generatedAssets.shorelines, settings.variants, settings.terrainSize, hexHeight, false);
        addSheetPreview(preview, sheet.canvas, 'shorelines.png', sheet.json);
    }

    // Vegetation sprite sheet (WITH cropping and anchor points)
    if (generatedAssets.bushes.length > 0) {
        const sheet = createCroppedSpriteSheet(generatedAssets.bushes, getSettings().variants);
        addSheetPreview(preview, sheet.canvas, 'environment-details.png', sheet.json);
    }

    // Characters sprite sheet (WITH cropping and anchor points)
    if (generatedAssets.characters.length > 0) {
        const sheet = createCroppedSpriteSheet(generatedAssets.characters, 4);
        addSheetPreview(preview, sheet.canvas, 'unit-sprites.png', sheet.json);
    }

    showTab('sheets');
}

/**
 * Create sprite sheet with fixed-size sprites (for terrain)
 */
function createSpriteSheet(assets, columns, spriteWidth, spriteHeight, enableCropping = false) {
    const rows = Math.ceil(assets.length / columns);
    const sheetWidth = columns * spriteWidth;
    const sheetHeight = rows * spriteHeight;

    const canvas = document.createElement('canvas');
    canvas.width = sheetWidth;
    canvas.height = sheetHeight;
    const ctx = canvas.getContext('2d');

    const sprites = [];

    assets.forEach((asset, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * spriteWidth;
        const y = row * spriteHeight;

        ctx.drawImage(asset.canvas, x, y);

        sprites.push({
            id: asset.label,
            bounds: { x, y, width: spriteWidth, height: spriteHeight },
            metadata: {
                type: asset.type,
                subtype: asset.subtype,
                detailType: asset.detailType,
                variant: asset.variant,
                unitClass: asset.unitClass,
                state: asset.state,
                player: asset.player
            }
        });
    });

    const json = {
        version: '1.0',
        dimensions: { width: sheetWidth, height: sheetHeight },
        sprites
    };

    return { canvas, json };
}

/**
 * Create sprite sheet for isometric terrain tiles with earth layers
 * Includes anchor points for proper positioning (anchor at hex surface center-bottom)
 */
function createTerrainSpriteSheet(assets, columns, spriteWidth, totalHeight, hexHeight, earthLayerHeight) {
    const rows = Math.ceil(assets.length / columns);
    const sheetWidth = columns * spriteWidth;
    const sheetHeight = rows * totalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = sheetWidth;
    canvas.height = sheetHeight;
    const ctx = canvas.getContext('2d');

    const sprites = [];

    assets.forEach((asset, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * spriteWidth;
        const y = row * totalHeight;

        ctx.drawImage(asset.canvas, x, y);

        sprites.push({
            id: asset.label,
            bounds: { x, y, width: spriteWidth, height: totalHeight },
            // Content bounds describe where the hex surface is (excluding earth layer overhang)
            contentBounds: {
                x: 0,
                y: 0,
                width: spriteWidth,
                height: hexHeight  // Just the hex surface
            },
            // Anchor at center-bottom of hex surface (above earth layer)
            // This is where the tile "sits" on the ground plane
            anchor: {
                x: 0.5,
                y: hexHeight / totalHeight  // Normalized position at bottom of hex surface
            },
            earthLayerHeight: earthLayerHeight,
            metadata: {
                type: asset.type,
                subtype: asset.subtype,
                detailType: asset.detailType,
                variant: asset.variant
            }
        });
    });

    const json = {
        version: '2.0',
        dimensions: { width: sheetWidth, height: sheetHeight },
        tileInfo: {
            spriteWidth,
            totalHeight,
            hexHeight,
            earthLayerHeight
        },
        features: ['isometric', 'earthLayer', 'anchored'],
        sprites
    };

    return { canvas, json };
}

/**
 * Create sprite sheet with cropped sprites and anchor points
 * Uses row-based packing where each row has uniform height
 * @param {Array} assets - Array of asset objects with canvas property
 * @param {number} columns - Number of columns (sprites per row)
 * @returns {Object} { canvas, json }
 */
function createCroppedSpriteSheet(assets, columns) {
    // First, crop all assets and calculate row heights
    const croppedAssets = assets.map(asset => {
        const cropped = cropWhitespace(asset.canvas, 2);
        return {
            ...asset,
            croppedCanvas: cropped.canvas,
            anchor: cropped.anchor,
            originalSize: cropped.originalSize,
            croppedSize: cropped.croppedSize
        };
    });

    // Group into rows
    const rows = [];
    for (let i = 0; i < croppedAssets.length; i += columns) {
        rows.push(croppedAssets.slice(i, i + columns));
    }

    // Calculate max height per row and max width per column
    const rowHeights = rows.map(row =>
        Math.max(...row.map(a => a.croppedSize.height))
    );
    const colWidths = [];
    for (let col = 0; col < columns; col++) {
        let maxWidth = 0;
        for (const row of rows) {
            if (row[col]) {
                maxWidth = Math.max(maxWidth, row[col].croppedSize.width);
            }
        }
        colWidths.push(maxWidth);
    }

    // Calculate total dimensions
    const sheetWidth = colWidths.reduce((a, b) => a + b, 0);
    const sheetHeight = rowHeights.reduce((a, b) => a + b, 0);

    // Create sprite sheet canvas
    const canvas = document.createElement('canvas');
    canvas.width = sheetWidth;
    canvas.height = sheetHeight;
    const ctx = canvas.getContext('2d');

    const sprites = [];
    let currentY = 0;

    rows.forEach((row, rowIndex) => {
        const rowHeight = rowHeights[rowIndex];
        let currentX = 0;

        row.forEach((asset, colIndex) => {
            const colWidth = colWidths[colIndex];

            // Center sprite horizontally within cell, align to bottom vertically
            const offsetX = Math.floor((colWidth - asset.croppedSize.width) / 2);
            const offsetY = rowHeight - asset.croppedSize.height;

            const x = currentX + offsetX;
            const y = currentY + offsetY;

            // Draw the cropped sprite
            ctx.drawImage(asset.croppedCanvas, x, y);

            // Store sprite info with anchor point
            sprites.push({
                id: asset.label,
                bounds: {
                    x: currentX,
                    y: currentY,
                    width: colWidth,
                    height: rowHeight
                },
                // Actual content bounds within the cell
                contentBounds: {
                    x: x,
                    y: y,
                    width: asset.croppedSize.width,
                    height: asset.croppedSize.height
                },
                // Anchor point (normalized 0-1, relative to contentBounds)
                anchor: asset.anchor,
                metadata: {
                    type: asset.type,
                    subtype: asset.subtype,
                    variant: asset.variant,
                    unitClass: asset.unitClass,
                    state: asset.state,
                    player: asset.player,
                    originalSize: asset.originalSize
                }
            });

            currentX += colWidth;
        });

        currentY += rowHeight;
    });

    const json = {
        version: '2.0', // New version with anchor support
        dimensions: { width: sheetWidth, height: sheetHeight },
        features: ['cropped', 'anchored'],
        sprites
    };

    return { canvas, json };
}

function addSheetPreview(container, canvas, filename, json) {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.style.textAlign = 'left';
    div.style.padding = '20px';

    const label = document.createElement('div');
    label.className = 'label';
    label.style.marginBottom = '10px';
    label.style.fontSize = '14px';
    label.innerHTML = `<strong>${filename}</strong> (${canvas.width}x${canvas.height})`;
    div.appendChild(label);

    const canvasClone = document.createElement('canvas');
    canvasClone.width = canvas.width;
    canvasClone.height = canvas.height;
    canvasClone.getContext('2d').drawImage(canvas, 0, 0);
    canvasClone.style.maxWidth = '100%';
    div.appendChild(canvasClone);

    // Buttons container
    const btnContainer = document.createElement('div');
    btnContainer.style.marginTop = '10px';
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.flexWrap = 'wrap';

    // Save to assets button (primary action)
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.style.width = 'auto';
    saveBtn.style.background = '#22c55e';
    saveBtn.textContent = '💾 Save to Assets';
    saveBtn.onclick = () => saveToAssets(canvasClone, filename, json);
    btnContainer.appendChild(saveBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn';
    downloadBtn.style.width = 'auto';
    downloadBtn.textContent = '📥 Download PNG';
    downloadBtn.onclick = () => downloadCanvas(canvasClone, filename);
    btnContainer.appendChild(downloadBtn);

    const jsonBtn = document.createElement('button');
    jsonBtn.className = 'btn';
    jsonBtn.style.width = 'auto';
    jsonBtn.textContent = '📄 Download JSON';
    jsonBtn.onclick = () => downloadJSON(json, filename.replace('.png', '.json'));
    btnContainer.appendChild(jsonBtn);

    div.appendChild(btnContainer);
    container.appendChild(div);
}

function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function downloadJSON(json, filename) {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
}

// Save to assets/spritesheets folder via API
async function saveToAssets(canvas, filename, json) {
    try {
        updateStatus(`Saving ${filename}...`);

        const imageData = canvas.toDataURL('image/png');

        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, imageData, jsonData: json })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Save failed');
        }

        updateStatus(`✓ Saved ${filename} to assets/spritesheets/`);
    } catch (err) {
        console.error('Save error:', err);
        updateStatus(`❌ Error saving ${filename}: ${err.message}`);

        // If API not available, fall back to download
        if (err.message.includes('fetch')) {
            updateStatus('API not available. Use the CLI tool for direct saving.');
        }
    }
}

// Save all sprite sheets to assets
async function saveAllToAssets() {
    if (generatedAssets.terrain.length === 0 &&
        generatedAssets.trees.length === 0 &&
        generatedAssets.bushes.length === 0 &&
        generatedAssets.characters.length === 0) {
        alert('Please generate some assets first!');
        return;
    }

    updateStatus('Saving all assets...');

    // Create sprite sheets if needed
    await createSpriteSheets();

    // Find all save buttons and click them
    const saveButtons = document.querySelectorAll('#sheetsPreview button');
    for (const btn of saveButtons) {
        if (btn.textContent.includes('Save to Assets')) {
            btn.click();
            await new Promise(r => setTimeout(r, 500)); // Wait between saves
        }
    }

    updateStatus('All assets saved to assets/spritesheets/');
}

// Download all as ZIP
async function downloadAll() {
    if (generatedAssets.terrain.length === 0 &&
        generatedAssets.trees.length === 0 &&
        generatedAssets.bushes.length === 0 &&
        generatedAssets.characters.length === 0) {
        alert('Please generate some assets first!');
        return;
    }

    updateStatus('Preparing download...');

    // Create all sprite sheets if not already done
    await createSpriteSheets();

    // For simplicity, download each sheet individually
    // A proper ZIP library would be needed for bundling
    const sheetsPreview = document.getElementById('sheetsPreview');
    const buttons = sheetsPreview.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.textContent.includes('PNG')) {
            btn.click();
        }
    });

    // Small delay between downloads
    setTimeout(() => {
        buttons.forEach(btn => {
            if (btn.textContent.includes('JSON')) {
                btn.click();
            }
        });
    }, 500);

    updateStatus('Downloads started!');
}

// Initialize
console.log('Shadow Squad Asset Generator loaded');
updateStatus('Ready to generate assets. Select options and click Generate.');
