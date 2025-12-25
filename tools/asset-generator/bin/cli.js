#!/usr/bin/env node

/**
 * Shadow Squad Asset Generator CLI
 *
 * Launches a browser-based asset generator tool.
 *
 * Usage:
 *   npx shadow-squad-assets
 *   npx shadow-squad-assets --port 8080
 */

import { Command } from 'commander';
import chalk from 'chalk';
import express from 'express';
import open from 'open';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
    .name('shadow-squad-assets')
    .description('Procedural asset generator for Shadow Squad tactical game')
    .version(packageJson.version)
    .option('-p, --port <port>', 'Port to run the server on', '3000')
    .option('--no-open', 'Do not automatically open browser')
    .action(async (options) => {
        console.log(chalk.cyan.bold('\n🎮 Shadow Squad Asset Generator\n'));

        const port = parseInt(options.port, 10);
        const app = express();

        // Serve static files from public directory
        const publicDir = path.join(__dirname, '..', 'public');
        app.use(express.static(publicDir));
        app.use(express.json({ limit: '50mb' }));

        // Assets directory - go up from tools/asset-generator/bin to project root
        const projectRoot = path.resolve(__dirname, '..', '..', '..');
        const assetsDir = path.join(projectRoot, 'assets', 'spritesheets');
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }
        console.log(chalk.gray(`  Assets will be saved to: ${assetsDir}`));

        // API endpoint to save sprite sheets to assets folder
        app.post('/api/save', async (req, res) => {
            try {
                const { filename, imageData, jsonData } = req.body;

                if (!filename || !imageData) {
                    return res.status(400).json({ error: 'Missing filename or imageData' });
                }

                // Save PNG file
                const pngPath = path.join(assetsDir, filename);
                const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
                fs.writeFileSync(pngPath, Buffer.from(base64Data, 'base64'));
                console.log(chalk.green(`  ✓ Saved ${filename}`));

                // Save JSON file
                if (jsonData) {
                    const jsonFilename = filename.replace('.png', '.json');
                    const jsonPath = path.join(assetsDir, jsonFilename);
                    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
                    console.log(chalk.green(`  ✓ Saved ${jsonFilename}`));
                }

                res.json({ success: true, path: pngPath });
            } catch (err) {
                console.error(chalk.red('Error saving file:', err.message));
                res.status(500).json({ error: err.message });
            }
        });

        // Ensure output directory exists
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Start server
        const server = app.listen(port, () => {
            const url = `http://localhost:${port}`;
            console.log(chalk.green(`✅ Server running at ${chalk.bold(url)}`));
            console.log(chalk.gray('\nFeatures:'));
            console.log(chalk.gray('  • L-System procedural trees (oak, pine, birch, willow, maple, dead)'));
            console.log(chalk.gray('  • Seamless hex terrain textures with Simplex noise'));
            console.log(chalk.gray('  • Character sprites with classes, poses, and player colors'));
            console.log(chalk.gray('  • Vegetation sprites (bushes, grass, ferns)'));
            console.log(chalk.gray('  • Automatic sprite sheet generation with JSON metadata'));
            console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));

            if (options.open !== false) {
                open(url);
            }
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\n\nShutting down...'));
            server.close(() => {
                console.log(chalk.green('Server stopped.'));
                process.exit(0);
            });
        });
    });

program.parse();
