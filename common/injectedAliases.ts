import path from 'node:path'

/**
 * Returns the `@injected/*` aliases for Rsbuild.
 *
 * `@injected/<path>` resolves to `common/src/<path>` unless the application
 * overrides it with its own `src/<path>`.
 *
 * @param appDir root directory of the application (where rsbuild.config.ts lives)
 * @param overrides paths, relative to the application `src/`, that the application overrides
 */
export function getInjectedAliases(
  appDir: string,
  overrides: readonly string[]
): Record<string, string> {
  const resolvedOverrides = Object.fromEntries(
    overrides.map(override => [
      `@injected/${override}`,
      path.resolve(appDir, 'src', override)
    ])
  )

  return {
    ...resolvedOverrides,
    '@injected': path.resolve(appDir, '../../common/src')
  }
}
