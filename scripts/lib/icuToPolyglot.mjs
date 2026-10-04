// Conversion of the ICU MessageFormat subset used by the Flutter ARB files
// (simple placeholders and one plural block) into Polyglot phrases, the
// format of twake-i18n: `%{name}` placeholders and `||||`-separated plural
// forms selected by `smart_count`.

export const SMART_COUNT = 'smart_count'

/**
 * Plural forms expected by Polyglot, in order, for each supported locale.
 * Polyglot picks the form from `smart_count` with the rule of the locale:
 * see `pluralTypeToLanguages` in node-polyglot.
 */
export const POLYGLOT_PLURAL_CATEGORIES = {
  en: ['one', 'other'],
  fr: ['one', 'other'],
  ru: ['one', 'few', 'many'],
  vi: ['other']
}

class IcuSyntaxError extends Error {
  constructor(message, source) {
    super(`${message} in "${source}"`)
    this.name = 'IcuSyntaxError'
  }
}

/**
 * Parses an ICU message into nodes:
 * - { type: 'text', value }
 * - { type: 'argument', name }
 * - { type: 'plural', name, options: { [selector]: nodes } }
 * - { type: 'pound' } (the `#` of a plural option)
 */
export function parseIcuMessage(source) {
  let index = 0

  function parseNodes(inPlural, closing) {
    const nodes = []
    let text = ''

    const flushText = () => {
      if (text) nodes.push({ type: 'text', value: text })
      text = ''
    }

    while (index < source.length) {
      const char = source[index]

      if (char === "'") {
        const next = source[index + 1]
        if (next === "'") {
          text += "'"
          index += 2
          continue
        }
        if (next === '{' || next === '}' || (inPlural && next === '#')) {
          const end = source.indexOf("'", index + 1)
          if (end === -1) throw new IcuSyntaxError('Unterminated quote', source)
          text += source.slice(index + 1, end)
          index = end + 1
          continue
        }
        text += char
        index += 1
        continue
      }

      if (char === '}') {
        if (!closing) throw new IcuSyntaxError('Unexpected "}"', source)
        flushText()
        return nodes
      }

      if (char === '#' && inPlural) {
        flushText()
        nodes.push({ type: 'pound' })
        index += 1
        continue
      }

      if (char === '{') {
        flushText()
        index += 1
        nodes.push(parseArgument())
        continue
      }

      text += char
      index += 1
    }

    if (closing) throw new IcuSyntaxError('Missing "}"', source)
    flushText()
    return nodes
  }

  function skipSpaces() {
    while (/\s/.test(source[index] ?? '')) index += 1
  }

  function readIdentifier() {
    skipSpaces()
    const match = /^[A-Za-z0-9_=]+/.exec(source.slice(index))
    if (!match) throw new IcuSyntaxError('Expected an identifier', source)
    index += match[0].length
    skipSpaces()
    return match[0]
  }

  function parseArgument() {
    const name = readIdentifier()
    if (source[index] === '}') {
      index += 1
      return { type: 'argument', name }
    }
    if (source[index] !== ',') {
      throw new IcuSyntaxError(`Unexpected "${source[index]}"`, source)
    }
    index += 1
    const kind = readIdentifier()
    if (kind !== 'plural') {
      throw new IcuSyntaxError(`Unsupported argument type "${kind}"`, source)
    }
    if (source[index] !== ',') throw new IcuSyntaxError('Expected ","', source)
    index += 1

    const options = {}
    skipSpaces()
    while (source[index] !== '}') {
      const selector = readIdentifier()
      if (source[index] !== '{') {
        throw new IcuSyntaxError(`Expected "{" after "${selector}"`, source)
      }
      index += 1
      options[selector] = parseNodes(true, true)
      index += 1
      skipSpaces()
      if (index >= source.length) {
        throw new IcuSyntaxError('Unterminated plural', source)
      }
    }
    index += 1
    if (!('other' in options)) {
      throw new IcuSyntaxError('Plural without "other" option', source)
    }
    return { type: 'plural', name, options }
  }

  return parseNodes(false, false)
}

function serialize(nodes, pluralName) {
  return nodes
    .map(node => {
      switch (node.type) {
        case 'text':
          return node.value
        case 'pound':
          return `%{${SMART_COUNT}}`
        case 'argument':
          return `%{${node.name === pluralName ? SMART_COUNT : node.name}}`
        default:
          throw new Error('Nested plurals are not supported')
      }
    })
    .join('')
}

function pickOption(options, category) {
  if (options[category]) return options[category]
  if (category === 'one' && options['=1']) return options['=1']
  return options.other
}

/**
 * Converts one ICU message to a Polyglot phrase for a locale.
 *
 * @param source the ICU message
 * @param locale the locale of the message, which decides the plural forms
 * @param options.pluralVariable the variable another locale (usually English)
 *   pluralizes: a translation without plural block still has to read it from
 *   `smart_count`, since callers pass the count only once
 * @returns {{ phrase: string, pluralVariable: string | null, warnings: string[] }}
 */
export function convertIcuMessage(source, locale, { pluralVariable } = {}) {
  const nodes = parseIcuMessage(source)
  const plurals = nodes.filter(node => node.type === 'plural')

  if (plurals.length === 0) {
    const usesPluralVariable =
      Boolean(pluralVariable) &&
      nodes.some(
        node => node.type === 'argument' && node.name === pluralVariable
      )
    return {
      phrase: serialize(nodes, usesPluralVariable ? pluralVariable : null),
      pluralVariable: usesPluralVariable ? pluralVariable : null,
      warnings: usesPluralVariable
        ? [
            `not pluralized in this locale, "${pluralVariable}" read from smart_count`
          ]
        : []
    }
  }
  if (plurals.length > 1) {
    throw new Error(`More than one plural block in "${source}"`)
  }

  const categories = POLYGLOT_PLURAL_CATEGORIES[locale]
  if (!categories) {
    throw new Error(`No plural rule known for locale "${locale}"`)
  }

  const [plural] = plurals
  const position = nodes.indexOf(plural)
  const prefix = nodes.slice(0, position)
  const suffix = nodes.slice(position + 1)
  const warnings = Object.keys(plural.options)
    .filter(selector => selector === '=0' || /^=\d+$/.test(selector))
    .filter(selector => selector !== '=1' || !categories.includes('one'))
    .map(
      selector =>
        `explicit "${selector}" form has no Polyglot equivalent and was dropped`
    )

  const phrase = categories
    .map(category =>
      serialize(
        [...prefix, ...pickOption(plural.options, category), ...suffix],
        plural.name
      )
    )
    .join(' |||| ')

  return { phrase, pluralVariable: plural.name, warnings }
}
