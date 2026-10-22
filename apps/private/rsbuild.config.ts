import { createRequire } from 'node:module'
import path from 'node:path'

import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

import { getInjectedAliases } from '../../common/injectedAliases'
import {
  isSentryConfigured,
  setupSentryPlugin
} from '../../common/sentryBuildUtils'
import { injectedAliases } from './injectedAliases'
import { makeJmapDevProxy } from './jmapDevProxy'

const appDir = import.meta.dirname
const require = createRequire(import.meta.url)
const pdfjsVersion = (require('pdfjs-dist/package.json') as { version: string })
  .version
const assetsDir = 'static/assets'

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    template: '../../public/index.html'
  },
  server: {
    host: process.env.HOST ?? 'localhost',
    port: Number(process.env.PORT ?? 5000),
    // /login-callback.html (DOMAIN_REDIRECT_URL) has a dot but is a route
    historyApiFallback: { disableDotRule: true },
    publicDir: { name: '../../public' },
    // e.g. JMAP_PROXY_TARGET=http://127.0.0.1:18300 (see the README)
    proxy: makeJmapDevProxy(process.env.JMAP_PROXY_TARGET)
  },
  source: {
    entry: {
      index: './src/index.tsx'
    }
  },
  output: {
    distPath: {
      root: 'dist',
      assets: assetsDir
    },
    sourceMap: {
      js: isSentryConfigured() ? 'source-map' : false
    },
    // The JavaScript decoders of CCITT and JBIG2 (jbig2) and of JPX
    // (openjpeg) images, which pdf.js loads by their fixed names from
    // `wasmUrl`, next to the worker (see pdfjs.ts): the version in the path
    // keeps a cached file from serving another pdf.js
    copy: ['jbig2', 'openjpeg'].map(decoder => ({
      from: require.resolve(`pdfjs-dist/wasm/${decoder}_nowasm_fallback.js`),
      to: `${assetsDir}/pdfjs/${pdfjsVersion}/[name][ext]`,
      // Already minified by pdf.js
      info: { minimized: true }
    }))
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
      // Before `@`: the first matching alias wins
      '@/ds': path.resolve(appDir, '../../common/src/ds'),
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
