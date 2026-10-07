import { cleanFileName } from './cleanFileName'

describe('cleanFileName', () => {
  it('keeps a plain name', () => {
    expect(cleanFileName('report.pdf')).toBe('report.pdf')
  })

  it('drops C0 and C1 control characters', () => {
    expect(cleanFileName('report\u0007.pdf')).toBe('report.pdf')
    expect(cleanFileName('a\u0000b\u007fc\u009f.txt')).toBe('abc.txt')
  })

  it('turns line breaks and tabs into spaces', () => {
    expect(cleanFileName('my\nreport\t2026.pdf')).toBe('my report 2026.pdf')
  })

  it('drops bidi controls that would spoof the extension', () => {
    expect(cleanFileName('invoice‮txt.exe')).toBe('invoicetxt.exe')
    expect(cleanFileName('⁦a⁩‎‏b؜.txt')).toBe('ab.txt')
  })

  it('returns null when nothing is left', () => {
    expect(cleanFileName('\u0007‮ ')).toBe(null)
    expect(cleanFileName('')).toBe(null)
    expect(cleanFileName(null)).toBe(null)
    expect(cleanFileName(undefined)).toBe(null)
  })
})
