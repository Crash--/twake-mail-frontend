/**
 * `@injected/*` paths overridden by the private application.
 *
 * To override an `@injected/*` module with a custom implementation:
 * 1. Copy it with `npm run copy-from-common <path-relative-to-common/src>`.
 * 2. Add the path, relative to `src/` and without extension, to this list
 *    (e.g. `'layout/AppTitle'`).
 */
export const injectedAliases: readonly string[] = []
