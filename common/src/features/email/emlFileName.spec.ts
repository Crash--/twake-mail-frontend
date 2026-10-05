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
