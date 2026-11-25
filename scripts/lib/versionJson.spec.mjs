import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { versionJson } from './versionJson.mjs'

function notesDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-'))
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text)
  }
  return dir
}

describe('versionJson', () => {
  it('writes the notes of each language, trimmed', () => {
    const dir = notesDir({
      'en.md': '- Faster "search"\n- Dark mode\n',
      'fr.md': "\n- Recherche plus rapide : « l'essai »\n"
    })
    assert.deepEqual(JSON.parse(versionJson('1.2.3', dir)), {
      build: '1.2.3',
      notes: {
        en: '- Faster "search"\n- Dark mode',
        fr: "- Recherche plus rapide : « l'essai »"
      }
    })
  })

  it('writes every language there is, and ends the lines with \\n alone', () => {
    const dir = notesDir({
      'de.md': '- Dunkler Modus\r\n- Schnellere Suche\r\n',
      'en.md': '- Dark mode\r- Faster search',
      'fr.md': '- Mode sombre\n'
    })
    assert.deepEqual(JSON.parse(versionJson('1.2.3', dir)), {
      build: '1.2.3',
      notes: {
        de: '- Dunkler Modus\n- Schnellere Suche',
        en: '- Dark mode\n- Faster search',
        fr: '- Mode sombre'
      }
    })
  })

  it('leaves out a blank file and any file not named by a language code', () => {
    const dir = notesDir({
      'en.md': '- Dark mode',
      'fr.md': ' \n',
      'README.md': '# Notes',
      'whats-new-light.png': 'png'
    })
    assert.deepEqual(JSON.parse(versionJson('1.2.3', dir)), {
      build: '1.2.3',
      notes: { en: '- Dark mode' }
    })
  })

  it('names the build alone without notes', () => {
    assert.equal(
      versionJson('dev', notesDir({ 'en.md': '' })),
      '{"build":"dev"}'
    )
  })
})
