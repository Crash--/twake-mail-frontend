import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'

import { cspScriptHashes } from './cspScriptHashes.mjs'

function sha256(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`
}

describe('cspScriptHashes', () => {
  it('hashes the exact content of an inline script', () => {
    const script = '\n      var a = 1\n    '
    assert.deepEqual(
      cspScriptHashes(`<head><script>${script}</script></head>`),
      [sha256(script)]
    )
  })

  it('ignores external scripts, even with an inline body', () => {
    assert.deepEqual(
      cspScriptHashes(
        '<script src="/.env.js"></script><script defer src="/a.js">x</script>'
      ),
      []
    )
  })

  it('keeps the document order and drops duplicates and empty scripts', () => {
    const html =
      '<script>b()</script><script type="module">a()</script><script>b()</script><script> </script>'
    assert.deepEqual(cspScriptHashes(html), [sha256('b()'), sha256('a()')])
  })

  it('hashes non-ASCII content as UTF-8', () => {
    const script = "var t = 'Обновить'"
    assert.deepEqual(cspScriptHashes(`<script>${script}</script>`), [
      sha256(script)
    ])
  })
})
