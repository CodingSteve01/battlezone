import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['js/**/*.js'],
            exclude: ['js/main.js', 'js/renderer.js', 'js/input.js', 'js/spriteSheetLoader.js']
        }
    }
});
