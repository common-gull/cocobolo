import eslint from '@eslint/js';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

// Shared globals for all configurations
const sharedGlobals = {
  // Browser globals
  document: 'readonly',
  navigator: 'readonly',
  window: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  // React globals
  React: 'readonly',
  // Node.js globals
  process: 'readonly',
  module: 'readonly',
  require: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  // TypeScript globals
  NodeJS: 'readonly',
};

// Shared settings for React and import plugins
const sharedSettings = {
  react: {
    version: 'detect',
  },
  'import/resolver': {
    node: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
  },
};

// Shared rules for all configurations
const sharedRules = {
  // React rules
  'react/react-in-jsx-scope': 'off', // Not needed in React 17+
  'react/prop-types': 'off', // We use TypeScript for prop validation

  // Import rules
  'import/order': [
    'error',
    {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    },
  ],

  // General rules
  'no-console': ['warn', { allow: ['warn', 'error'] }],
};

export default [
  eslint.configs.recommended,

  // JavaScript files configuration
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'import': importPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: sharedGlobals,
    },
    settings: sharedSettings,
    rules: {
      ...sharedRules,
    },
  },

  // TypeScript files configuration
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslintPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'import': importPlugin,
    },
    languageOptions: {
      parser: tseslintParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: ['./tsconfig.json'],
      },
      globals: sharedGlobals,
    },
    settings: sharedSettings,
    rules: {
      ...sharedRules,

      // TypeScript-specific rules
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_|^on[A-Z]|Props$',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src-tauri/**',
      'vite.config.ts',
      'postcss.config.cjs',
      'playwright.config.ts',
      'playwright-report/**',
      'test-results/**',
      'frontend-tests/**',
      '*.d.ts'
    ],
  }
];
