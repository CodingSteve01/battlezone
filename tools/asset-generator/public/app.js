/**
 * Shadow Squad Asset Generator - Main App
 */

// Storage for generated assets
const generatedAssets = {
    terrain: [],
    trees: [],
    bushes: [],
    characters: []
};

// Helper functions
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
    const types = getSelectedTypes('terrainTypes');
    const preview = document.getElementById('terrainPreview');
    preview.innerHTML = '';
    generatedAssets.terrain = [];

    // For flat-top hex: width = 2*r, height = sqrt(3)*r
    // So height/width = sqrt(3)/2 ≈ 0.866
    const hexHeight = Math.round(settings.terrainSize * Math.sqrt(3) / 2);
    const total = types.length * settings.variants;
    let count = 0;

    updateStatus('Generating terrain textures...');

    for (const type of types) {
        for (let v = 0; v < settings.variants; v++) {
            const canvas = TerrainGenerator.generate(type, v, settings.terrainSize, hexHeight);
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

    const classes = ['scout', 'assault', 'medic', 'sniper', 'commando'];
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

// Generate all
async function generateAll() {
    updateStatus('Generating all assets...');
    updateProgress(0);

    await generateTerrain();
    updateProgress(25);

    await generateTrees();
    updateProgress(50);

    await generateBushes();
    updateProgress(75);

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

    // Terrain sprite sheet
    if (generatedAssets.terrain.length > 0) {
        const settings = getSettings();
        const hexHeight = Math.round(settings.terrainSize * Math.sqrt(3) / 2);
        const sheet = createSpriteSheet(generatedAssets.terrain, settings.variants, settings.terrainSize, hexHeight);
        addSheetPreview(preview, sheet.canvas, 'terrain-hexes.png', sheet.json);
    }

    // Trees sprite sheet
    if (generatedAssets.trees.length > 0) {
        const sheet = createSpriteSheet(generatedAssets.trees, getSettings().variants, 256, 380);
        addSheetPreview(preview, sheet.canvas, 'trees.png', sheet.json);
    }

    // Vegetation sprite sheet
    if (generatedAssets.bushes.length > 0) {
        const sheet = createSpriteSheet(generatedAssets.bushes, getSettings().variants, 307, 344);
        addSheetPreview(preview, sheet.canvas, 'environment-details.png', sheet.json);
    }

    // Characters sprite sheet
    if (generatedAssets.characters.length > 0) {
        const sheet = createSpriteSheet(generatedAssets.characters, 4, getSettings().charSize, getSettings().charSize);
        addSheetPreview(preview, sheet.canvas, 'unit-sprites.png', sheet.json);
    }

    showTab('sheets');
}

function createSpriteSheet(assets, columns, spriteWidth, spriteHeight) {
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
