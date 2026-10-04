// Imports translations from the Flutter ARB files of tmail-flutter into the
// locale files of this project (common/src/locales/<lang>.json).
//
// Usage:
//   npm run import-flutter-arb -- --arb-dir <tmail-flutter>/lib/l10n \
//     [--locales en,fr,ru,vi] [--dry-run] <arbKey>[=<target.path>] ...
//
// Each ARB key is written at <target.path> (dot-separated, defaults to the
// ARB key itself) in every locale. English comes from intl_messages.arb, the
// ARB template. A key missing from a locale falls back to English and is
// reported. Plurals are converted to Polyglot forms driven by `smart_count`.
// See docs/i18n.md.
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { convertIcuMessage } from './lib/icuToPolyglot.mjs'

const DEFAULT_LOCALES = ['en', 'fr', 'ru', 'vi']
const LOCALES_DIR = path.resolve(import.meta.dirname, '../common/src/locales')

function arbFileName(locale) {
  return locale === 'en' ? 'intl_messages.arb' : `intl_${locale}.arb`
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function setAtPath(target, dottedPath, value) {
  const segments = dottedPath.split('.')
  const last = segments.pop()
  let node = target
  for (const segment of segments) {
    if (typeof node[segment] !== 'object' || node[segment] === null) {
      node[segment] = {}
    }
    node = node[segment]
  }
  node[last] = value
}

function parseMapping(argument) {
  const [arbKey, targetPath] = argument.split('=')
  return { arbKey, targetPath: targetPath || arbKey }
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'arb-dir': { type: 'string' },
      locales: { type: 'string', default: DEFAULT_LOCALES.join(',') },
      'dry-run': { type: 'boolean', default: false }
    }
  })

  if (!values['arb-dir'] || positionals.length === 0) {
    console.error(
      'Usage: npm run import-flutter-arb -- --arb-dir <dir> [--locales en,fr] [--dry-run] <arbKey>[=<target.path>] ...'
    )
    process.exit(1)
  }

  const arbDir = path.resolve(values['arb-dir'])
  const locales = values.locales.split(',').map(locale => locale.trim())
  const mappings = positionals.map(parseMapping)
  const englishArb = readJson(path.join(arbDir, arbFileName('en')))
  let hasError = false

  const englishPluralVariables = new Map()
  for (const { arbKey } of mappings) {
    try {
      const { pluralVariable } = convertIcuMessage(
        englishArb[arbKey] ?? '',
        'en'
      )
      if (pluralVariable) englishPluralVariables.set(arbKey, pluralVariable)
    } catch {
      // reported below, with the locale
    }
  }

  for (const locale of locales) {
    const arb =
      locale === 'en'
        ? englishArb
        : readJson(path.join(arbDir, arbFileName(locale)))
    const localeFile = path.join(LOCALES_DIR, `${locale}.json`)
    const dictionary = fs.existsSync(localeFile) ? readJson(localeFile) : {}

    for (const { arbKey, targetPath } of mappings) {
      const source = arb[arbKey] ?? englishArb[arbKey]
      if (typeof source !== 'string') {
        console.error(`[${locale}] ${arbKey}: not found in the ARB files`)
        hasError = true
        continue
      }
      if (arb[arbKey] === undefined) {
        console.warn(`[${locale}] ${arbKey}: missing, English used instead`)
      }
      try {
        const { phrase, pluralVariable, warnings } = convertIcuMessage(
          source,
          locale,
          { pluralVariable: englishPluralVariables.get(arbKey) }
        )
        warnings.forEach(warning =>
          console.warn(`[${locale}] ${arbKey}: ${warning}`)
        )
        if (pluralVariable) {
          console.info(
            `[${locale}] ${arbKey}: plural on "${pluralVariable}", pass it as smart_count`
          )
        }
        setAtPath(dictionary, targetPath, phrase)
        console.info(`[${locale}] ${targetPath} = ${JSON.stringify(phrase)}`)
      } catch (error) {
        console.error(`[${locale}] ${arbKey}: ${error.message}`)
        hasError = true
      }
    }

    if (!values['dry-run']) {
      fs.writeFileSync(localeFile, `${JSON.stringify(dictionary, null, 2)}\n`)
    }
  }

  process.exit(hasError ? 1 : 0)
}

main()
