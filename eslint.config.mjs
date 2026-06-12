import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

// Flat config (ESLint 9/10). Ports the former .eslintrc.json:
//   eslint:recommended + @typescript-eslint/recommended + astro/recommended
//   + prettier/recommended, with prettier disabled inside .astro files.
export default tseslint.config(
  {
    ignores: [
      'dist/',
      '.netlify/',
      'node_modules/',
      'mobile/',
      'src/styles/theme.generated.css',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Prettier formatting is handled by prettier-plugin-astro, not eslint, here.
    files: ['**/*.astro'],
    rules: { 'prettier/prettier': 'off' },
  },
);
