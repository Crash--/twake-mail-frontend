/**
 * A URL template with `{name}` placeholders, raw or URL-encoded
 * (`%7Bname%7D`), as tmail-flutter's `UrlTemplate`. A template with an
 * unclosed, nested, unmatched or empty placeholder is malformed.
 */

type Token =
  | { kind: 'literal'; value: string }
  | { kind: 'placeholder'; source: string; name: string }

type Marker = 'raw' | 'encoded'

function isEncodedMarker(
  input: string,
  index: number,
  last: 'b' | 'd'
): boolean {
  return (
    input[index] === '%' &&
    input[index + 1] === '7' &&
    input[index + 2]?.toLowerCase() === last
  )
}

/** The tokens of the template; null when it is malformed */
function scan(template: string): Token[] | null {
  const tokens: Token[] = []
  const state: {
    open: { marker: Marker; start: number; nameStart: number } | null
  } = { open: null }
  let literalStart = 0
  let index = 0

  const pushLiteral = (end: number): void => {
    if (end > literalStart) {
      tokens.push({ kind: 'literal', value: template.slice(literalStart, end) })
    }
  }
  const openPlaceholder = (marker: Marker, length: number): boolean => {
    if (state.open !== null) return false
    pushLiteral(index)
    state.open = { marker, start: index, nameStart: index + length }
    index += length
    return true
  }
  const closePlaceholder = (marker: Marker, length: number): boolean => {
    const { open } = state
    if (open?.marker !== marker || index === open.nameStart) return false
    const end = index + length
    tokens.push({
      kind: 'placeholder',
      source: template.slice(open.start, end),
      name: template.slice(open.nameStart, index)
    })
    state.open = null
    index = end
    literalStart = end
    return true
  }

  while (index < template.length) {
    const char = template[index]
    let isValid = true
    if (isEncodedMarker(template, index, 'b')) {
      isValid = openPlaceholder('encoded', 3)
    } else if (isEncodedMarker(template, index, 'd')) {
      isValid = closePlaceholder('encoded', 3)
    } else if (char === '{') {
      isValid = openPlaceholder('raw', 1)
    } else if (char === '}') {
      isValid = closePlaceholder('raw', 1)
    } else {
      index += 1
    }
    if (!isValid) return null
  }
  if (state.open !== null) return null
  pushLiteral(template.length)
  return tokens
}

/**
 * The template with its placeholders replaced. A placeholder with no
 * variable of that name stays as it is; one whose variable is null makes the
 * template unresolvable (a half-filled URL points at the wrong host), as a
 * malformed template does: null.
 */
export function resolveUrlTemplate(
  template: string,
  variables: Readonly<Record<string, string | null>>
): string | null {
  const tokens = scan(template)
  if (tokens === null) return null
  let output = ''
  for (const token of tokens) {
    if (token.kind === 'literal') {
      output += token.value
    } else if (Object.hasOwn(variables, token.name)) {
      const value = variables[token.name]
      if (value === null || value === undefined) return null
      output += value
    } else {
      output += token.source
    }
  }
  return output
}

/** Whether the (well-formed) template has a `{name}` placeholder */
export function usesPlaceholder(template: string, name: string): boolean {
  const tokens = scan(template)
  return (
    tokens?.some(
      token => token.kind === 'placeholder' && token.name === name
    ) === true
  )
}
