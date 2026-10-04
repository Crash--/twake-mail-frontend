import path from 'node:path'

import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

import { getInjectedAliases } from '../../common/injectedAliases'
import {
  isSentryConfigured,
  setupSentryPlugin
} from '../../common/sentryBuildUtils'
import { injectedAliases } from './injectedAliases'

const appDir = import.meta.dirname

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    template: '../../public/index.html'
  },
  server: {
    host: process.env.HOST ?? 'localhost',
    port: Number(process.env.PORT ?? 5000),
    historyApiFallback: true,
    publicDir: { name: '../../public' }
  },
  source: {
    entry: {
      index: './src/index.tsx'
    }
  },
  output: {
    distPath: {
      root: 'dist'
    },
    sourceMap: {
      js: isSentryConfigured() ? 'source-map' : false
    }
  },
  splitChunks: {
    preset: 'default',
    cacheGroups: {
      mui: {
        test: /node_modules[\\/](@mui|@emotion|@linagora)[\\/]/,
        name: 'lib-ui',
        chunks: 'all',
        priority: 20
      },
      sentry: {
        test: /node_modules[\\/]@sentry[\\/]/,
        name: 'lib-sentry',
        chunks: 'all',
        priority: 20
      }
    }
  },
  resolve: {
    aliasStrategy: 'prefer-alias',
    alias: {
      ...getInjectedAliases(appDir, injectedAliases),
      '@': path.resolve(appDir, 'src'),
      '@common': path.resolve(appDir, '../../common/src')
    }
  },
  tools: {
    rspack(_, { appendPlugins }) {
      setupSentryPlugin(appendPlugins, 'dist')
    }
  }
})
