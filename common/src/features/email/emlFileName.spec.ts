import {
  elapsedMs,
  randomTexts,
  STRESS_TIME_LIMIT_MS
} from '@common/testing/redos'

import { emlFileName } from './emlFileName'

describe('emlFileName', () => {
  it('names the file after the subject', () => {
    expect(emlFileName('Weekly news', 'blob-1')).toBe('Weekly news.eml')
  })

  it('replaces what a path or a file system would read', () => {
    expect(emlFileName('../etc/passwd: a*b?', 'blob-1')).toBe(
      '_etc_passwd_ a_b_.eml'
    )
  })

  it('falls back to the blob id without a subject', () => {
    expect(emlFileName(null, 'blob-1')).toBe('blob-1.eml')
    expect(emlFileName('  ..  ', 'blob-1')).toBe('blob-1.eml')
  })

  it('keeps the name short', () => {
    expect(emlFileName('a'.repeat(500), 'b').length).toBe(150 + '.eml'.length)
  })

  it('does not end the name with a dot when the cut falls in a run of dots', () => {
    expect(emlFileName(`Report${'.'.repeat(160)}v2`, 'blob-1')).toBe(
      'Report.eml'
    )
  })

  it('does not end the name with a space then a dot after the cut', () => {
    expect(emlFileName(`${'a'.repeat(148)} .xyz`, 'blob-1')).toBe(
      `${'a'.repeat(148)}.eml`
    )
  })

  it('does not keep half of a character cut at the limit', () => {
    expect(emlFileName(`${'a'.repeat(149)}\ud83d\ude00`, 'blob-1')).toBe(
      `${'a'.repeat(149)}.eml`
    )
  })
})

describe('emlFileName against ReDoS', () => {
  it('trims both edges of the cut subject as a plain trim', () => {
    const plain = (subject: string): string =>
      subject
        .replace(/^[\s.]+/, '')
        .slice(0, 150)
        .replace(/[\s.]+$/, '')
    for (const subject of randomTexts(['.', ' ', '\u00a0', 'a', 'b'])) {
      expect([subject, emlFileName(subject, 'blob')]).toEqual([
        subject,
        `${plain(subject) || 'blob'}.eml`
      ])
    }
  })

  it('names a subject of spaces in a linear time', () => {
    const subject = 'x' + ' '.repeat(50_000) + 'x'
    expect(elapsedMs(() => emlFileName(subject, 'blob'))).toBeLessThan(
      STRESS_TIME_LIMIT_MS
    )
  })
})
