import fs from 'node:fs'
import path from 'node:path'

/**
 * The body of /version.json: the build, and the notes of `dir`, one `<lang>.md`
 * per language code, with \n line ends; a blank file is left out, and `notes`
 * too when none is left
 */
export function versionJson(build, dir) {
  const notes = {}
  for (const file of fs.readdirSync(dir).sort()) {
    const lang = /^([a-z]{2,3})\.md$/.exec(file)?.[1]
    if (!lang) continue
    const text = fs
      .readFileSync(path.join(dir, file), 'utf8')
      .replace(/\r\n?/g, '\n')
      .trim()
    if (text) notes[lang] = text
  }
  return JSON.stringify(
    Object.keys(notes).length ? { build, notes } : { build }
  )
}
