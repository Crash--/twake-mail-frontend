import type { Config } from 'jest'

// Dates are rendered and compared in UTC whatever the machine timezone
process.env.TZ = 'UTC'

// Packages published as ES modules only, transpiled to CommonJS for Jest
const ESM_PACKAGES = [
  '@linagora/twake-mui',
  '@linagora/twake-icons',
  '@linagora/twake-utils',
  '@linagora/twake-css',
  '@linagora/twake-embed',
  'openid-client',
  'oauth4webapi',
  'jose',
  'jmap-client-ts'
]

const transform: Config['transform'] = {
  '^.+\\.[cm]?[jt]sx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }]
}

const transformIgnorePatterns = [
  `/node_modules/(?!(${ESM_PACKAGES.join('|')})/)`
]

const moduleNameMapper: Config['moduleNameMapper'] = {
  // These packages only export an `import` condition, which Jest's CommonJS
  // resolution does not match: point at their entry file
  '^@linagora/twake-mui$':
    '<rootDir>/node_modules/@linagora/twake-mui/dist/index.js',
  '^@linagora/twake-utils$':
    '<rootDir>/node_modules/@linagora/twake-utils/dist/index.js',
  '^@injected/(.*)$': [
    '<rootDir>/apps/private/src/$1',
    '<rootDir>/common/src/$1'
  ],
  '^@common/(.*)$': '<rootDir>/common/src/$1',
  // Before `@/`: the local design system lives in common, not in the app
  '^@/ds/(.*)$': '<rootDir>/common/src/ds/$1',
  '^@/(.*)$': '<rootDir>/apps/private/src/$1',
  '\\.css$': '<rootDir>/common/src/testing/styleMock.ts'
}

const shared = {
  clearMocks: true,
  restoreMocks: true,
  roots: ['<rootDir>/apps', '<rootDir>/common'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform,
  transformIgnorePatterns,
  moduleNameMapper
} satisfies Config

const config: Config = {
  collectCoverageFrom: [
    'apps/*/src/**/*.{ts,tsx}',
    'common/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/testing/**'
  ],
  coverageDirectory: 'coverage',
  projects: [
    {
      ...shared,
      displayName: 'dom',
      testEnvironment: '<rootDir>/common/src/testing/jsdomEnvironment.ts',
      testMatch: ['**/*.spec.tsx'],
      setupFilesAfterEnv: ['<rootDir>/common/src/testing/setupDomTests.ts']
    },
    {
      ...shared,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/*.spec.ts']
    }
  ]
}

export default config
