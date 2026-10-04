// Copies a module of common/src into an application, so that the
// application can override it through the `@injected/*` alias.
//
// Usage: npm run copy-from-common <path-relative-to-common/src> [app]
import fs from 'node:fs'
import path from 'node:path'

const [inputPath, targetApp = 'private'] = process.argv.slice(2)

if (!inputPath) {
  console.error(
    'Usage: npm run copy-from-common <path-relative-to-common/src> [app]'
  )
  process.exit(1)
}

const rootDir = path.resolve(import.meta.dirname, '..')
const appDir = path.join(rootDir, 'apps', targetApp)

if (!fs.existsSync(appDir)) {
  console.error(`Error: application "${targetApp}" does not exist`)
  process.exit(1)
}

const sourcePath = path.join(rootDir, 'common/src', inputPath)
const targetPath = path.join(appDir, 'src', inputPath)

if (!fs.existsSync(sourcePath)) {
  console.error(`Error: source file does not exist at ${sourcePath}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true })
fs.copyFileSync(sourcePath, targetPath)
console.info(`Copied:\n  From: ${sourcePath}\n  To:   ${targetPath}`)
console.info(
  `Add '${inputPath.replace(/\.[jt]sx?$/, '')}' to apps/${targetApp}/injectedAliases.ts`
)
