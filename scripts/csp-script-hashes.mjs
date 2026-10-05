// Prints the CSP hash sources of the inline scripts of a built index.html, on
// one line, for the `script-src` directive of the Docker image (see
// apps/private/Dockerfile and deploy/docker/40-twake-mail-runtime.sh).
//
// Usage: node scripts/csp-script-hashes.mjs apps/private/dist/index.html
import fs from 'node:fs'

import { cspScriptHashes } from './lib/cspScriptHashes.mjs'

const [file] = process.argv.slice(2)
if (!file) {
  console.error('Usage: node scripts/csp-script-hashes.mjs <index.html>')
  process.exit(1)
}

console.log(cspScriptHashes(fs.readFileSync(file, 'utf8')).join(' '))
