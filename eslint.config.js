import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tanstackQuery from '@tanstack/eslint-plugin-query'
import jest from 'eslint-plugin-jest'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// eslint-config-cozy-app is not used: it pins its own typescript-eslint and
// prettier, requires TypeScript 5 and ships eslint-plugin-react, which does
// not support ESLint 10 yet. Calendar and Contacts force them with npm
// `overrides`; composing the plugins directly needs none.

const UI_IMPORT_RESTRICTIONS = {
  patterns: [
    {
      group: ['@mui/*', '@mui/*/**'],
      message:
        'Import components from @linagora/twake-mui, never from MUI directly (AGENTS.md).'
    },
    {
      group: ['cozy-ui', 'cozy-ui/**'],
      message: 'cozy-ui is not used in Twake Mail: use @linagora/twake-mui.'
    },
    {
      group: ['@linagora/twake-mui/*'],
      message: 'Import from the @linagora/twake-mui entry point.'
    }
  ]
}

const FORBIDDEN_SYNTAX = [
  {
    selector: 'ExportDefaultDeclaration',
    message: 'Named exports only (twake-javascript-conventions).'
  },
  {
    selector: 'TSEnumDeclaration',
    message: 'Use a string union instead of an enum.'
  },
  {
    selector: 'JSXAttribute[name.name="style"]',
    message: 'No inline style: use twake-mui props or twake-css classes.'
  },
  {
    selector: 'JSXAttribute[name.name="sx"]',
    message: 'No sx: use twake-mui props or twake-css classes.'
  },
  {
    selector:
      'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
    message: 'No `as unknown as T`: fix the type model instead.'
  }
]

export default defineConfig(
  {
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/node_modules/',
      '.tsbuild/',
      'e2e/',
      'public/'
    ]
  },

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true
        }
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } }
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true }
      ],
      // `void promise` marks fire-and-forget calls whose promise never rejects
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off'
    }
  },

  {
    files: ['apps/**/*.{ts,tsx}', 'common/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      'no-restricted-imports': ['error', UI_IMPORT_RESTRICTIONS],
      'no-restricted-syntax': ['error', ...FORBIDDEN_SYNTAX]
    }
  },

  ...tanstackQuery.configs['flat/recommended'],

  {
    files: ['**/*.spec.{ts,tsx}', '**/testing/**/*.{ts,tsx}'],
    ...jest.configs['flat/recommended'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.jest }
    },
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/no-restricted-matchers': [
        'error',
        {
          toMatchSnapshot: 'No snapshot tests (twake-frontend-testing).',
          toMatchInlineSnapshot: 'No snapshot tests (twake-frontend-testing).'
        }
      ],
      '@typescript-eslint/unbound-method': 'off',
      'jest/unbound-method': 'error',
      // Asymmetric matchers (expect.objectContaining…) are typed `any`
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  },

  {
    // Tool configuration files: their tools expect a default export
    files: ['apps/*/rsbuild.config.ts'],
    rules: { 'no-restricted-syntax': 'off' }
  },

  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      eqeqeq: ['error', 'always']
    }
  },

  prettierRecommended
)
