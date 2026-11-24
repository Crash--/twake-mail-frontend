import tanstackQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import { define } from 'rstack'

/** The local design system (`@/ds/*`), the only place allowed raw MUI */
const DS_FILES = ['common/src/ds/**/*.{ts,tsx}']

const TS_FILES = ['**/*.{ts,tsx}']

const COMMON_IMPORT_PATTERNS = [
  {
    group: ['cozy-ui', 'cozy-ui/**'],
    message: 'cozy-ui is not used in Twake Mail: use @linagora/twake-mui.'
  },
  {
    group: ['@linagora/twake-mui/*'],
    message: 'Import from the @linagora/twake-mui entry point.'
  }
]

const CHECKBOX_GLYPHS_RESTRICTION = {
  name: '@/ds/FlutterIcons/FlutterIcons',
  importNames: ['CheckboxOff', 'CheckboxOn'],
  message: "A checkbox is twake-mui's Checkbox, as it is."
}

const UI_IMPORT_RESTRICTIONS = {
  paths: [
    {
      name: '@linagora/twake-mui',
      importNames: ['styled'],
      message:
        'No styled components outside the design system: use @/ds/ (common/src/ds/README.md).'
    },
    CHECKBOX_GLYPHS_RESTRICTION
  ],
  patterns: [
    {
      group: ['@mui/*', '@mui/*/**'],
      message:
        'Import components from @linagora/twake-mui, never from MUI directly (AGENTS.md). Missing UI goes to @/ds/.'
    },
    {
      group: ['@emotion/*', '@emotion/*/**'],
      message:
        'No styled components outside the design system: use @/ds/ (common/src/ds/README.md).'
    },
    ...COMMON_IMPORT_PATTERNS
  ]
}

const DS_BUSINESS_MESSAGE =
  'The design system (@/ds/) holds no business logic: no JMAP, data, routing, translations nor app code. Pass values and labels as props (common/src/ds/README.md).'

/** The design system is UI only: MUI is allowed, business code is not */
const DS_IMPORT_RESTRICTIONS = {
  paths: [
    { name: '@linagora/jmap-client-ts', message: DS_BUSINESS_MESSAGE },
    { name: 'react-router', message: DS_BUSINESS_MESSAGE },
    { name: 'twake-i18n', message: DS_BUSINESS_MESSAGE },
    CHECKBOX_GLYPHS_RESTRICTION
  ],
  patterns: [
    {
      group: [
        '@linagora/jmap-client-ts/**',
        'react-router/**',
        'react-router-dom',
        'twake-i18n/**',
        '@tanstack/*',
        '@tanstack/*/**',
        '@injected/*',
        '**/features',
        '**/features/**',
        '**/jmap',
        '**/jmap/**',
        '**/app',
        '**/app/**',
        '**/config',
        '**/config/**',
        '**/i18n',
        '**/i18n/**'
      ],
      message: DS_BUSINESS_MESSAGE
    },
    ...COMMON_IMPORT_PATTERNS
  ]
}

const SX_SYNTAX = {
  selector: 'JSXAttribute[name.name="sx"]',
  message:
    'No sx outside the design system: use twake-mui props, twake-css classes, or a @/ds/ component.'
}

const FORBIDDEN_SYNTAX = [
  {
    selector:
      'JSXOpeningElement[name.name="Checkbox"] > JSXAttribute[name.name=/^(icon|checkedIcon|sx)$/]',
    message: "A checkbox is twake-mui's Checkbox, as it is."
  },
  {
    selector:
      'ImportSpecifier[imported.name="Checkbox"][local.name!="Checkbox"], ImportNamespaceSpecifier[parent.source.value="@linagora/twake-mui"], VariableDeclarator[init.name="Checkbox"], JSXMemberExpression[property.name="Checkbox"]',
    message: "A checkbox is twake-mui's Checkbox, as it is."
  },
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
    selector:
      'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
    message: 'No `as unknown as T`: fix the type model instead.'
  }
]

// The React Compiler rules of eslint-plugin-react-hooks, which Rslint does not
// port. Rslint reserves the react-hooks prefix for its own rules.
const reactCompilerRules = Object.fromEntries(
  Object.entries(reactHooks.configs['recommended-latest'].rules)
    .filter(([rule]) => !/\/(rules-of-hooks|exhaustive-deps)$/.test(rule))
    .map(([rule, level]) => [
      rule.replace('react-hooks/', 'react-compiler/'),
      level
    ])
)

// Rslint's no-restricted-syntax does not match TypeScript nodes such as
// TSAsExpression (web-infra-dev/rslint#2626), nor attributes read through
// `parent`. ESLint's rule runs those selectors, through the JS plugins.
const NEEDS_JS = /\bTS(?!EnumDeclaration)|\bparent\./

const tsSyntax = {
  rules: {
    'no-restricted-syntax': {
      meta: { schema: false },
      create: context =>
        Object.fromEntries(
          context.options.map(({ selector, message }) => [
            selector,
            node => context.report({ node, message })
          ])
        )
    }
  }
}

// Splits "a, b" at the commas outside brackets, parentheses and quotes
const splitSelector = selector => {
  const parts = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i]
    if (quote) {
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if (char === ',' && depth === 0) {
      parts.push(selector.slice(start, i).trim())
      start = i + 1
    }
  }
  return [...parts, selector.slice(start).trim()]
}

/** no-restricted-syntax, with its TypeScript selectors in the JS rule */
const restrictedSyntax = (level, ...restrictions) => {
  const native = []
  const ts = []
  for (const { selector, message } of restrictions) {
    const parts = splitSelector(selector)
    const nativeParts = parts.filter(part => !NEEDS_JS.test(part))
    const tsParts = parts.filter(part => NEEDS_JS.test(part))
    if (nativeParts.length > 0) {
      native.push({ selector: nativeParts.join(', '), message })
    }
    if (tsParts.length > 0) ts.push({ selector: tsParts.join(', '), message })
  }
  return {
    'no-restricted-syntax': [level, ...native],
    'ts-syntax/no-restricted-syntax': [level, ...ts]
  }
}

// typescript-eslint's presets apply to TypeScript files only
const onTs = entries =>
  entries.map(entry =>
    entry.rules && !entry.files ? { ...entry, files: TS_FILES } : entry
  )

const config = lint => [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '.tsbuild/**',
      'e2e/**',
      'public/**',
      // Runtime configuration served as /.env.js to the browser, as public/.env.js
      'scripts/qa-environment/app-env.js'
    ]
  },

  lint.js.configs.recommended,
  // Turned off by eslint-config-prettier
  { rules: { 'no-unexpected-multiline': 'off' } },
  ...onTs(lint.ts.configs.strictTypeChecked),
  { files: TS_FILES, rules: lint.ts.configs.stylisticTypeChecked.at(-1).rules },

  {
    files: TS_FILES,
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
    plugins: ['react-hooks'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      'no-restricted-imports': ['error', UI_IMPORT_RESTRICTIONS],
      ...restrictedSyntax('error', ...FORBIDDEN_SYNTAX, SX_SYNTAX)
    }
  },

  {
    files: ['apps/**/*.{ts,tsx}', 'common/**/*.{ts,tsx}'],
    plugins: { 'react-compiler': reactHooks, 'ts-syntax': tsSyntax },
    rules: reactCompilerRules
  },

  {
    // Flat config replaces rule options, it does not merge them: both
    // rules are restated whole for the design system
    files: DS_FILES,
    rules: {
      'no-restricted-imports': ['error', DS_IMPORT_RESTRICTIONS],
      ...restrictedSyntax('error', ...FORBIDDEN_SYNTAX)
    }
  },

  {
    // twake-mui's VirtualizedTable needs a twake-i18n provider to render
    files: ['common/src/ds/testing/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', UI_IMPORT_RESTRICTIONS] }
  },

  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    plugins: { '@tanstack/query': tanstackQuery },
    rules: {
      ...tanstackQuery.configs['flat/recommended'][0].rules,
      // The JMAP client is not part of the query keys: there is one client
      // per sign-in and the cache is cleared when the session ends. Keys
      // start with the JMAP account id instead.
      '@tanstack/query/exhaustive-deps': [
        'error',
        { allowlist: { types: ['JmapClient'] } }
      ]
    }
  },

  {
    ...lint.jestPlugin.configs.recommended,
    files: ['**/*.spec.{ts,tsx}', '**/testing/**/*.{ts,tsx}'],
    rules: {
      ...lint.jestPlugin.configs.recommended.rules,
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
    files: [
      'apps/*/rsbuild.config.ts',
      'common/src/testing/jsdomEnvironment.ts'
    ],
    rules: {
      'no-restricted-syntax': 'off',
      'ts-syntax/no-restricted-syntax': 'off'
    }
  },

  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: lint.globals.node },
    rules: {
      // ESLint's recommended preset has it, Rslint's does not
      'no-undef': 'error',
      eqeqeq: ['error', 'always']
    }
  }
]

define.lint(lint =>
  config(lint).map(entry => ({ ...entry, basePath: import.meta.dirname }))
)

define.fmt({
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 80,
  tabWidth: 2,
  arrowParens: 'avoid',
  endOfLine: 'auto',
  ignorePatterns: [
    'build/',
    'dist/',
    'coverage/',
    '.tsbuild/',
    'package-lock.json',
    // Markdown docs (formatting handled manually)
    '*.md',
    '.env*',
    // End-to-end tests live in their own package
    'e2e/',
    // Helm chart: Go templates, checked by helm lint
    'deploy/helm/'
  ]
})
