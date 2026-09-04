import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      // مولّد تلقائياً من Next.js — لا يُحرَّر ولا يُفحص.
      'next-env.d.ts',
      '.next/**',
      'out/**',
      'playwright-report/**',
      'test-results/**',
      'src/generated/**',
      '.pgdata/**',
      '.storage/**',
      // شجرات عمل Claude Code المؤقتة — نسخة كاملة من المشروع، فحصها
      // يُكرّر كل خطأ ويُفشل `npm run verify` محلياً بلا سبب حقيقي.
      '.claude/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];

export default eslintConfig;
