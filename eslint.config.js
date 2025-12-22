import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021
            }
        },
        rules: {
            // Relaxed rules for existing codebase - warnings instead of errors
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            'no-console': 'off',
            'semi': ['error', 'always'],
            'quotes': ['warn', 'single', { avoidEscape: true }],
            'indent': 'off', // Disable for existing code
            'no-multiple-empty-lines': ['warn', { max: 2 }],
            'eqeqeq': ['warn', 'always'],
            'curly': 'off', // Existing code style
            'no-var': 'warn',
            'prefer-const': 'warn',
            'no-case-declarations': 'warn' // Common pattern in switch statements
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },
    {
        ignores: ['node_modules/', 'dist/', 'coverage/']
    }
];
