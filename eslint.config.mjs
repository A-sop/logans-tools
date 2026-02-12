import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  js.configs.recommended,
  ...compat.extends('next/core-web-vitals', 'prettier'),
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
export default config;
