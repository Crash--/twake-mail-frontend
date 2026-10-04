import { sentryWebpackPlugin } from '@sentry/webpack-plugin'

type RspackPlugin = ReturnType<typeof sentryWebpackPlugin>

/**
 * Whether the build has what it needs to upload source maps to Sentry.
 */
export function isSentryConfigured(): boolean {
  return Boolean(
    process.env.SENTRY_URL &&
    process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT
  )
}

/**
 * Registers the Sentry plugin that uploads the source maps, then deletes them
 * from the build output so that they are never served.
 *
 * @param appendPlugins function given by Rsbuild `tools.rspack` to register Rspack plugins
 * @param outputDir directory of the build output
 */
export function setupSentryPlugin(
  appendPlugins: (plugin: RspackPlugin) => void,
  outputDir = 'dist'
): boolean {
  if (!isSentryConfigured()) {
    return false
  }

  const cleanOutputDir = outputDir.replace(/\/+$/, '')

  appendPlugins(
    sentryWebpackPlugin({
      url: process.env.SENTRY_URL,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      sourcemaps: {
        filesToDeleteAfterUpload: `${cleanOutputDir}/**/*.map`
      }
    })
  )
  return true
}
