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
})

describe('emlFileName against ReDoS', () => {
  it('trims the subject as before', () => {
    const original = (subject: string): string =>
      subject.replace(/^[\s.]+|[\s.]+$/g, '')
    for (const subject of randomTexts(['.', ' ', '\u00a0', 'a', 'b'])) {
      expect([subject, emlFileName(subject, 'blob')]).toEqual([
        subject,
        `${original(subject).slice(0, 150).trim() || 'blob'}.eml`
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
