/**
 * WebGL Mesh-Based Renderer for Shadow Squad
 * 
 * Renders hex tiles as a 3D mesh with texture mapping and height-based shading.
 * Features:
 * - Mesh-based hex tile rendering
 * - Rectangular texture mapping (UV coordinates)
 * - Height-based shading via vertex colors and lighting
 * - Fog of war support
 * - Unit and detail rendering
 */

import { CONFIG, TERRAIN } from './config.js';
import { state, getHex } from './state.js';
import { hexToPixel } from './hexMath.js';
import { getFogLevel } from './fogOfWar.js';
import { createWebGLTexture, getTerrainUVCoords } from './textureAtlas.js';
import { logEntry, logError } from './errorLog.js';

// WebGL context and resources
let gl = null;
let canvas = null;
let program = null;
let meshBuffer = null;
let textureAtlas = null;

// Shader attribute/uniform locations
let locations = {
    attributes: {},
    uniforms: {}
};

// Mesh data
let hexMeshData = {
    vertices: [],
    uvs: [],
    colors: [],
    indices: []
};

// Texture atlas will be loaded from textureAtlas module

// Vertex shader - handles position, texture coords, and height-based lighting
const VERTEX_SHADER = `
    attribute vec3 a_position;
    attribute vec2 a_texCoord;
    attribute vec4 a_color;
    
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform vec3 u_lightDirection;
    uniform float u_lightHeight;
    
    varying vec2 v_texCoord;
    varying vec4 v_color;
    varying float v_heightShade;
    
    void main() {
        gl_Position = u_projectionMatrix * u_viewMatrix * vec4(a_position, 1.0);
        v_texCoord = a_texCoord;
        v_color = a_color;
        
        // Height-based shading: higher positions get more light
        float heightFactor = (a_position.z + 1.0) / 4.0; // Normalize to 0-1 range
        v_heightShade = mix(0.85, 1.15, heightFactor);
    }
`;

// Fragment shader - applies textures and shading
const FRAGMENT_SHADER = `
    precision mediump float;
    
    uniform sampler2D u_texture;
    uniform float u_fogStrength;
    
    varying vec2 v_texCoord;
    varying vec4 v_color;
    varying float v_heightShade;
    
    void main() {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        vec4 finalColor = texColor * v_color * v_heightShade;
        
        // Apply fog
        finalColor.rgb = mix(finalColor.rgb, vec3(0.02, 0.03, 0.06), u_fogStrength);
        
        gl_FragColor = finalColor;
    }
`;

/**
 * Initialize WebGL renderer
 * @param {HTMLCanvasElement} canvasElement - Canvas to render to
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initWebGLRenderer(canvasElement) {
    try {
        canvas = canvasElement;
        
        if (!canvas) {
            const error = new Error('Canvas element not provided');
            logError('[WebGL] Initialization failed', error);
            return false;
        }
        
        logEntry('info', '[WebGL] Initializing WebGL renderer', `Canvas: ${canvas.width}x${canvas.height}`);
        
        // Try to get WebGL context
        gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: true,
            depth: true,
            premultipliedAlpha: false
        }) || canvas.getContext('experimental-webgl', {
            alpha: true,
            antialias: true,
            depth: true,
            premultipliedAlpha: false
        });
        
        if (!gl) {
            const error = new Error('WebGL not supported in this browser');
            logError('[WebGL] Context creation failed', error);
            return false;
        }
        
        // Log WebGL capabilities
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            logEntry('info', '[WebGL] GPU Info', `Vendor: ${vendor}, Renderer: ${renderer}`);
        }
        
        logEntry('info', '[WebGL] Context created', `Version: ${gl.getParameter(gl.VERSION)}`);
    
        // Initialize shaders
        if (!initShaders()) {
            const error = new Error('Shader initialization failed');
            logError('[WebGL] Failed to initialize shaders', error);
            return false;
        }
        
        // Initialize buffers
        initBuffers();
        logEntry('info', '[WebGL] Buffers initialized', 'Position, TexCoord, Color, Index buffers created');
        
        // Load texture atlas
        try {
            textureAtlas = await createWebGLTexture(gl);
            logEntry('info', '[WebGL] Texture atlas loaded', `Texture ID: ${textureAtlas}`);
        } catch (err) {
            logError('[WebGL] Failed to load texture atlas', err);
            return false;
        }
        
        // Setup WebGL state
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Set clear color to match game background
        gl.clearColor(0.02, 0.03, 0.06, 1.0);
        
        logEntry('info', '[WebGL] Renderer initialized successfully', `Max texture size: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
        return true;
    } catch (err) {
        logError('[WebGL] Unexpected error during initialization', err);
        return false;
    }
}

/**
 * Compile and link shaders
 */
function initShaders() {
    try {
        // Compile vertex shader
        const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
        if (!vertexShader) {
            logError('[WebGL] Vertex shader compilation failed', new Error('See previous log for details'));
            return false;
        }
        
        // Compile fragment shader
        const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!fragmentShader) {
            logError('[WebGL] Fragment shader compilation failed', new Error('See previous log for details'));
            return false;
        }
        
        // Create program
        program = gl.createProgram();
        if (!program) {
            logError('[WebGL] Failed to create shader program', new Error('gl.createProgram returned null'));
            return false;
        }
        
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const programLog = gl.getProgramInfoLog(program);
            const error = new Error(`Shader program link error: ${programLog}`);
            logError('[WebGL] Program linking failed', error);
            return false;
        }
        
        // Get attribute locations
        locations.attributes.position = gl.getAttribLocation(program, 'a_position');
        locations.attributes.texCoord = gl.getAttribLocation(program, 'a_texCoord');
        locations.attributes.color = gl.getAttribLocation(program, 'a_color');
        
        // Validate attribute locations
        if (locations.attributes.position === -1) {
            logError('[WebGL] Failed to get attribute location', new Error('a_position not found in shader'));
            return false;
        }
        if (locations.attributes.texCoord === -1) {
            logError('[WebGL] Failed to get attribute location', new Error('a_texCoord not found in shader'));
            return false;
        }
        if (locations.attributes.color === -1) {
            logError('[WebGL] Failed to get attribute location', new Error('a_color not found in shader'));
            return false;
        }
        
        // Get uniform locations
        locations.uniforms.viewMatrix = gl.getUniformLocation(program, 'u_viewMatrix');
        locations.uniforms.projectionMatrix = gl.getUniformLocation(program, 'u_projectionMatrix');
        locations.uniforms.lightDirection = gl.getUniformLocation(program, 'u_lightDirection');
        locations.uniforms.lightHeight = gl.getUniformLocation(program, 'u_lightHeight');
        locations.uniforms.texture = gl.getUniformLocation(program, 'u_texture');
        locations.uniforms.fogStrength = gl.getUniformLocation(program, 'u_fogStrength');
        
        // Validate uniform locations (null is acceptable for uniforms that might be optimized out)
        logEntry('info', '[WebGL] Shaders compiled and linked successfully', 
            `Attributes: position=${locations.attributes.position}, texCoord=${locations.attributes.texCoord}, color=${locations.attributes.color}`);
        
        return true;
    } catch (err) {
        logError('[WebGL] Unexpected error in shader initialization', err);
        return false;
    }
}

/**
 * Compile a shader
 */
function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
        logError('[WebGL] Failed to create shader', new Error(`Type: ${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}`));
        return null;
    }
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const shaderLog = gl.getShaderInfoLog(shader);
        const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        const error = new Error(`${shaderType} shader compile error: ${shaderLog}`);
        error.shaderSource = source;
        logError(`[WebGL] ${shaderType} shader compilation failed`, error);
        gl.deleteShader(shader);
        return null;
    }
    
    const shaderType = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    logEntry('info', `[WebGL] ${shaderType} shader compiled`, 'No errors');
    return shader;
}

/**
 * Initialize WebGL buffers
 */
function initBuffers() {
    meshBuffer = {
        position: gl.createBuffer(),
        texCoord: gl.createBuffer(),
        color: gl.createBuffer(),
        index: gl.createBuffer()
    };
}

/**
 * Generate hex mesh geometry for a single hex tile
 * Creates a hexagon with 6 triangles from center
 */
function generateHexGeometry(cx, cy, size, height, terrainType, fogLevel) {
    const baseIndex = hexMeshData.vertices.length / 3;
    const z = height * CONFIG.HEIGHT.MAX * 0.3; // Scale height for 3D effect
    
    // Get texture coordinates for this terrain type from atlas
    const [uMin, vMin, uMax, vMax] = getTerrainUVCoords(terrainType);
    
    // Calculate color based on fog level
    let colorAlpha = 1.0;
    let colorMod = 1.0;
    if (fogLevel === 'hidden') {
        colorAlpha = 0.3;
        colorMod = 0.3;
    } else if (fogLevel === 'explored') {
        colorAlpha = 1.0;
        colorMod = 0.6;
    }
    
    // Center vertex
    hexMeshData.vertices.push(cx, cy, z);
    hexMeshData.uvs.push((uMin + uMax) / 2, (vMin + vMax) / 2); // Center of texture
    hexMeshData.colors.push(colorMod, colorMod, colorMod, colorAlpha);
    
    // 6 outer vertices (hex corners)
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = cx + size * Math.cos(angle);
        const y = cy + size * Math.sin(angle);
        
        hexMeshData.vertices.push(x, y, z);
        
        // Map to rectangular texture coordinates
        // Use angle to interpolate between texture bounds
        const u = uMin + (uMax - uMin) * ((Math.cos(angle) + 1) / 2);
        const v = vMin + (vMax - vMin) * ((Math.sin(angle) + 1) / 2);
        hexMeshData.uvs.push(u, v);
        
        hexMeshData.colors.push(colorMod, colorMod, colorMod, colorAlpha);
    }
    
    // Create triangles (6 triangles from center to edges)
    for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6;
        hexMeshData.indices.push(
            baseIndex,           // Center
            baseIndex + 1 + i,   // Current vertex
            baseIndex + 1 + next // Next vertex
        );
    }
}

/**
 * Build mesh data for all visible hexes
 */
function buildHexMesh() {
    try {
        // Clear existing mesh data
        hexMeshData.vertices = [];
        hexMeshData.uvs = [];
        hexMeshData.colors = [];
        hexMeshData.indices = [];
        
        if (!state.hexes || state.hexes.length === 0) {
            logEntry('warn', '[WebGL] No hexes to build mesh from', 'state.hexes is empty or undefined');
            return;
        }
        
        const tileSize = CONFIG.BASE_HEX_SIZE * CONFIG.HEX_SIZE_SCALE * CONFIG.TILE_SCALE;
        
        // Generate geometry for each hex
        let generatedCount = 0;
        state.hexes.forEach((hex, index) => {
            try {
                const pos = hexToPixel(hex.q, hex.r, tileSize);
                const fogLevel = getFogLevel(hex.q, hex.r);
                
                generateHexGeometry(
                    pos.x,
                    pos.y,
                    tileSize,
                    hex.height || 0,
                    hex.type,
                    fogLevel
                );
                generatedCount++;
            } catch (err) {
                logError(`[WebGL] Failed to generate hex geometry at index ${index}`, err);
            }
        });
        
        const vertexCount = hexMeshData.vertices.length / 3;
        const triangleCount = hexMeshData.indices.length / 3;
        logEntry('info', '[WebGL] Mesh built successfully', 
            `Hexes: ${generatedCount}, Vertices: ${vertexCount}, Triangles: ${triangleCount}`);
    } catch (err) {
        logError('[WebGL] Failed to build hex mesh', err);
    }
}

/**
 * Upload mesh data to GPU buffers
 */
function uploadMeshData() {
    // Position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hexMeshData.vertices), gl.STATIC_DRAW);
    
    // Texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer.texCoord);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hexMeshData.uvs), gl.STATIC_DRAW);
    
    // Color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hexMeshData.colors), gl.STATIC_DRAW);
    
    // Index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffer.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(hexMeshData.indices), gl.STATIC_DRAW);
}

/**
 * Create view matrix (camera transform)
 */
function createViewMatrix() {
    const offsetX = state.offsetX || 0;
    const offsetY = state.offsetY || 0;
    const zoom = state.zoomLevel || 1;
    
    // Simple 2D orthographic view matrix (column-major order)
    // Translation is in the rightmost column (indices 12, 13, 14)
    return new Float32Array([
        zoom, 0, 0, 0,
        0, zoom, 0, 0,
        0, 0, 1, 0,
        offsetX, offsetY, 0, 1
    ]);
}

/**
 * Create projection matrix (orthographic for 2D game)
 */
function createProjectionMatrix() {
    const width = canvas.width;
    const height = canvas.height;
    
    // Orthographic projection matrix
    // Maps world coordinates to clip space (-1 to 1)
    const left = -width / 2;
    const right = width / 2;
    const bottom = height / 2;
    const top = -height / 2;
    const near = -100;
    const far = 100;
    
    return new Float32Array([
        2 / (right - left), 0, 0, 0,
        0, 2 / (top - bottom), 0, 0,
        0, 0, -2 / (far - near), 0,
        -(right + left) / (right - left), -(top + bottom) / (top - bottom), -(far + near) / (far - near), 1
    ]);
}

/**
 * Main render function
 * Called each frame to render the game using WebGL
 */
export function renderWebGL() {
    try {
        if (!gl || !program) {
            logError('[WebGL] Renderer not initialized', new Error('gl or program is null'));
            return;
        }
        
        // Rebuild mesh if needed (e.g., after map generation or fog of war update)
        if (state.meshDirty !== false) {
            logEntry('debug', '[WebGL] Rebuilding mesh', 'Mesh marked as dirty');
            buildHexMesh();
            uploadMeshData();
            state.meshDirty = false;
        }
        
        // Clear the canvas
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Use shader program
    gl.useProgram(program);
    
    // Set up matrices
    const viewMatrix = createViewMatrix();
    const projectionMatrix = createProjectionMatrix();
    
    gl.uniformMatrix4fv(locations.uniforms.viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(locations.uniforms.projectionMatrix, false, projectionMatrix);
    
    // Set lighting uniforms
    const lightDir = CONFIG.LIGHTING?.DIRECTION || { x: -0.6, y: -1.0 };
    gl.uniform3f(locations.uniforms.lightDirection, lightDir.x, lightDir.y, -1.0);
    gl.uniform1f(locations.uniforms.lightHeight, CONFIG.LIGHTING?.HEIGHT ?? 1.2);
    
    // Bind buffers and set up attributes
    // Position
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer.position);
    gl.enableVertexAttribArray(locations.attributes.position);
    gl.vertexAttribPointer(locations.attributes.position, 3, gl.FLOAT, false, 0, 0);
    
    // Texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer.texCoord);
    gl.enableVertexAttribArray(locations.attributes.texCoord);
    gl.vertexAttribPointer(locations.attributes.texCoord, 2, gl.FLOAT, false, 0, 0);
    
    // Colors
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer.color);
    gl.enableVertexAttribArray(locations.attributes.color);
    gl.vertexAttribPointer(locations.attributes.color, 4, gl.FLOAT, false, 0, 0);
    
    // Bind texture atlas
    if (textureAtlas) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureAtlas);
        gl.uniform1i(locations.uniforms.texture, 0);
    }
    
        // Bind index buffer and draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffer.index);
        
        if (hexMeshData.indices.length > 0) {
            gl.drawElements(gl.TRIANGLES, hexMeshData.indices.length, gl.UNSIGNED_SHORT, 0);
        }
    } catch (err) {
        logError('[WebGL] Render error', err);
    }
}

/**
 * Check if WebGL is available in the browser
 */
export function isWebGLAvailable() {
    try {
        const testCanvas = document.createElement('canvas');
        return !!(testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'));
    } catch (e) {
        return false;
    }
}

/**
 * Clean up WebGL resources
 */
export function cleanupWebGL() {
    if (gl) {
        // Delete buffers
        if (meshBuffer) {
            gl.deleteBuffer(meshBuffer.position);
            gl.deleteBuffer(meshBuffer.texCoord);
            gl.deleteBuffer(meshBuffer.color);
            gl.deleteBuffer(meshBuffer.index);
        }
        
        // Delete program
        if (program) {
            gl.deleteProgram(program);
        }
        
        // Lose context
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
            ext.loseContext();
        }
        
        gl = null;
    }
    
    console.log('[WebGL] Cleaned up resources');
}

/**
 * Mark mesh as dirty (needs rebuild)
 */
export function markMeshDirty() {
    if (state) {
        state.meshDirty = true;
    }
}
