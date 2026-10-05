import { createHash } from 'node:crypto'

// An inline script: a <script> element without a src attribute
const INLINE_SCRIPT =
  /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi

/**
 * Lists the CSP hash sources ('sha256-…') of the inline scripts of an HTML
 * document, in document order, without duplicates. The hash covers the exact
 * text between the tags, as the browser computes it.
 *
 * @param {string} html the HTML document
 * @returns {string[]} the hash sources, quoted as in a CSP directive
 */
export function cspScriptHashes(html) {
  const hashes = []
  for (const [, content] of html.matchAll(INLINE_SCRIPT)) {
    if (content.trim() === '') continue
    const digest = createHash('sha256').update(content, 'utf8').digest('base64')
    const source = `'sha256-${digest}'`
    if (!hashes.includes(source)) hashes.push(source)
  }
  return hashes
}
